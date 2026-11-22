/**
 * @nettoscorp/plugin-sdk — Protocolo de canal duplex (host <-> cliente/plugin)
 *
 * Canal bidirecional baseado em `MessageChannel` do Node. Permite que o host e
 * o plugin troquem mensagens (eventos e chamadas RPC) de forma desacoplada,
 * seja em processo ou em Worker. Cada mensagem tem um `id` para correlacao de
 * respostas RPC e um `type` para roteamento.
 */

export type MessageType = 'event' | 'rpc-call' | 'rpc-result' | 'rpc-error';

export interface DuplexMessage {
  id: string;
  type: MessageType;
  target?: string; // destino (evento ou servico RPC)
  payload: unknown;
  error?: string;
}

/** Resultado de uma chamada RPC. */
export interface RpcResult<T = unknown> {
  ok: true;
  value: T;
}

/** Erro de uma chamada RPC. */
export interface RpcError {
  ok: false;
  error: string;
  code: string;
}

export type RpcResponse<T = unknown> = RpcResult<T> | RpcError;

/** Canal duplex minimalista: envia e recebe mensagens. */
export interface DuplexChannel {
  /** Envia uma mensagem para o outro lado. */
  post(message: DuplexMessage): void;
  /** Escuta mensagens vindas do outro lado. Retorna cancelamento. */
  onMessage(handler: (message: DuplexMessage) => void): () => void;
  /** Fecha o canal. */
  close(): void;
}

/** Cria um par de canais conectados (lado A e lado B). */
export function createChannelPair(): [DuplexChannel, DuplexChannel] {
  const { port1, port2 } = new MessageChannel();

  const queues: DuplexMessage[][] = [[], []];
  const handlers: Array<((m: DuplexMessage) => void) | null> = [null, null];
  const closed = [false, false];

  const pump = (index: number) => {
    const queue = queues[index];
    const handler = handlers[index];
    while (queue.length && handler) {
      handler(queue.shift() as DuplexMessage);
    }
  };

  const makeChannel = (ownPort: MessagePort, index: number): DuplexChannel => {
    const peerIndex = 1 - index;
    ownPort.onmessage = (event: MessageEvent<DuplexMessage>) => {
      queues[peerIndex].push(event.data);
      pump(peerIndex);
    };
    ownPort.start();

    return {
      post(message: DuplexMessage): void {
        if (closed[index]) {
          throw new Error('Canal duplex ja foi fechado');
        }
        queues[peerIndex].push(message);
        pump(peerIndex);
        ownPort.postMessage(message);
      },
      onMessage(handler: (message: DuplexMessage) => void): () => void {
        handlers[index] = handler;
        pump(index);
        return () => {
          handlers[index] = null;
        };
      },
      close(): void {
        closed[index] = true;
        ownPort.close();
      },
    };
  };

  return [makeChannel(port1, 0), makeChannel(port2, 1)];
}
