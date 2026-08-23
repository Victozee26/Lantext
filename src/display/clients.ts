// clients.ts - Client connect/disconnect badges (plain-text).

export function clientConnected(clientId: string, totalClients: number): void {
  console.log(`\n  +1 Client connected: ${clientId} (${totalClients} online)`);
}

export function clientDisconnected(clientId: string, totalClients: number): void {
  console.log(`\n  -1 Client disconnected: ${clientId} (${totalClients} online)`);
}
