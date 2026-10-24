// use-connection.ts - Connection/status/room state bridge.
//
// Room state is intentionally local to this hook: the picker needs the full
// list, the status bar needs the selected label, and roomLost needs both an
// error line and the retry/choose actions. Transports stay behind ChatSession.

import { useEffect, useState } from 'react';
import type { ChatSession, RoomInfo, RoomLostInfo } from '../session-adapter.js';

export function useConnection(adapter: ChatSession) {
  const [status, setStatus] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);
  const [roomLost, setRoomLost] = useState<RoomLostInfo | null>(null);

  useEffect(() => {
    const onStatus = (message: string): void => setStatus(message);
    const onConnected = (address: string): void => setConnectedAddress(address);
    const onError = (message: string): void => setLastError(message);
    const onReady = (port: number): void => setServerPort(port);
    const onClientConnected = (event: { totalClients: number }): void => setClientCount(event.totalClients);
    const onClientDisconnected = (event: { totalClients: number }): void => setClientCount(event.totalClients);
    const onRooms = (found: RoomInfo[]): void => {
      setRooms(found);
      // A fresh batch means a choice is required again (initial scan or
      // "choose another"); hide the old selection until one is picked.
      setSelectedRoom(null);
      setRoomLost(null);
    };
    const onRoomSelected = (room: RoomInfo): void => {
      setSelectedRoom(room);
      setRoomLost(null);
    };
    const onRoomLost = (lost: RoomLostInfo): void => setRoomLost(lost);

    adapter.on('status', onStatus);
    adapter.on('connected', onConnected);
    adapter.on('error', onError);
    adapter.on('ready', onReady);
    adapter.on('clientConnected', onClientConnected);
    adapter.on('clientDisconnected', onClientDisconnected);
    adapter.on('rooms', onRooms);
    adapter.on('roomSelected', onRoomSelected);
    adapter.on('roomLost', onRoomLost);

    return () => {
      adapter.off('status', onStatus);
      adapter.off('connected', onConnected);
      adapter.off('error', onError);
      adapter.off('ready', onReady);
      adapter.off('clientConnected', onClientConnected);
      adapter.off('clientDisconnected', onClientDisconnected);
      adapter.off('rooms', onRooms);
      adapter.off('roomSelected', onRoomSelected);
      adapter.off('roomLost', onRoomLost);
    };
  }, [adapter]);

  /** Client actions clear local failure state before asking the transport;
   *  a failed retry emits `roomLost` again with fresh data. */
  const selectRoom = (key: string): boolean => {
    const accepted = adapter.selectRoom?.(key) ?? false;
    if (!accepted) return false;
    setRooms([]);
    return true;
  };

  const retryRoom = (): void => {
    setRoomLost(null);
    adapter.retryRoom?.();
  };

  const chooseAnotherRoom = (): void => {
    setRoomLost(null);
    setSelectedRoom(null);
    setRooms([]);
    adapter.chooseAnotherRoom?.();
  };

  return {
    status,
    connectedAddress,
    serverPort,
    clientCount,
    lastError,
    rooms,
    selectedRoom,
    roomLost,
    selectRoom,
    retryRoom,
    chooseAnotherRoom,
  };
}
