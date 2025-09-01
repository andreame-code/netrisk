export function createMatchModel(realtimePort) {
  return {
    async subscribe(channel, ui) {
      const { subscriptionId } = await realtimePort.subscribe({ channel });
      ui.appendLog(`Subscribed to ${channel}`);
      return async () => {
        await realtimePort.unsubscribe({ subscriptionId });
        ui.appendLog(`Unsubscribed from ${channel}`);
      };
    }
  };
}

export default createMatchModel;
