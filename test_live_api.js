// Using native fetch

async function run() {
  const url = 'https://becerril-ad-manager.vercel.app/api/send-email';
  const payload = {
    to: 'sbs.comite@gmail.com',
    subject: 'Test live api send-email from script',
    text: 'This is a test of the live api endpoint.'
  };

  try {
    console.log(`Sending POST request to ${url}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log('Response body:', data);
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

run();
