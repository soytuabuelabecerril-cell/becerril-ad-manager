import handler from './api/cron-reminders.js';

const mockReq = {
  method: 'GET',
  headers: {}
};

const mockRes = {
  setHeader: (name, value) => {
    console.log(`HEADER: ${name} = ${value}`);
  },
  status: (code) => {
    console.log(`STATUS: ${code}`);
    return {
      json: (data) => {
        console.log('JSON RESPONSE:', data);
      },
      end: () => {
        console.log('END RESPONSE');
      }
    };
  }
};

async function test() {
  console.log('Running local cron-reminders handler...');
  try {
    await handler(mockReq, mockRes);
  } catch (err) {
    console.error('CRASH:', err);
  }
}

test();
