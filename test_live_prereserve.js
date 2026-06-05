// Using native fetch

async function run() {
  const url = 'http://localhost:3001/api/send-email';
  const payload = {
    to: 'marc.truekalia@gmail.com',
    subject: 'Pre-Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. 15',
    text: 'Hola Cliente,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario.\n\nGracias,\nEquipo',
    html: '<p>Hola Cliente,</p><p>Confirmamos la pre-reserva (retención de 1 semana) del espacio publicitario.</p><p>Gracias,<br>Equipo</p>',
    background: true
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
    const text = await response.text();
    console.log('Response body:', text);
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

run();
