// Using native fetch

async function run() {
  const url = 'https://becerril-ad-manager.vercel.app/api/cron-reminders';
  try {
    console.log(`Sending GET request to ${url}...`);
    const response = await fetch(url, {
      method: 'GET'
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response body:', text);
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

run();
