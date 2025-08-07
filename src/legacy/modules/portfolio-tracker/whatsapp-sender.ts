export async function sendWhatsAppMessage(
  instanceId: string,
  token: string,
  securityToken: string,
  phone: string,
  message: string
): Promise<void> {
  const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': securityToken
    },
    body: JSON.stringify({
      phone,
      message
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to send WhatsApp message: ${response.statusText} - ${errorData}`);
  }
}
