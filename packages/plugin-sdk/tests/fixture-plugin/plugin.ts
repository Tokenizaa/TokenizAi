import { definePlugin } from '../../src/index';

export default definePlugin({
  name: 'exemplo-plugin',
  version: '1.0.0',
  description: 'Plugin de exemplo para o NettosCorp Plugin SDK v2.',
  hooks: {
    setup(context) {
      context.log('info', 'exemplo-plugin iniciado', { version: '1.0.0' });
      context.emit('plugin:ready', { name: 'exemplo-plugin' });
    },
    teardown() {
      // limpeza de recursos do plugin
    },
    subscriptions: ['chat:message:created'],
  },
});
