export class LocalModelClient {
  constructor({ baseUrl, model, apiKey }) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        stream: false
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Local model request failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error('Local model response did not include choices[0].message.content');
    }

    return content;
  }
}
