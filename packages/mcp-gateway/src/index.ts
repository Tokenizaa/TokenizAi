/**
 * @nettoscorp/mcp-gateway — Fase 2 — MCP HTTP/SSE gateway
 * Gateway para expor adapters ACP via MCP over HTTP/SSE.
 * Implementação placeholder — expande conforme necessidade de produção.
 */
export const MCP_GATEWAY_VERSION = '0.1.0';
export const MCP_GATEWAY_STATUS = 'placeholder';

export function createMCPGateway() {
  return {
    version: MCP_GATEWAY_VERSION,
    status: MCP_GATEWAY_STATUS,
    transports: ['stdio', 'http', 'sse'],
  };
}
