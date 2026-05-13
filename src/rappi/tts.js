export async function synthesizeSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new Error('Faltan ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID en .env');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        output_format: 'mp3_44100_128',
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ElevenLabs ${response.status}: ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
