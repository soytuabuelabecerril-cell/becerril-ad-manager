/**
 * Generates a WhatsApp deep link to send to the client.
 * 
 * @param {string} phoneNumber - The customer's WhatsApp number (e.g., "+34612345678")
 * @param {string} customerName - The commercial name of the customer
 * @param {number} pageNumber - The reserved page number
 * @param {string} invoiceUrl - The URL of the generated PDF invoice
 */
export const generateWhatsAppLink = (phoneNumber, customerName, pageNumber, invoiceUrl) => {
  // Clean phone number (remove non-digits, keep optional leading +)
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  
  const message = `Hola ${customerName}! 🌟\n\nTu reserva para la página ${pageNumber} en la revista "Becerril" ha sido registrada.\n\nPuedes descargar tu nota de reserva aquí: ${invoiceUrl}\n\n¡Gracias por confiar en "I AM YOUR GRANNY S.L."!`;
  
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

/**
 * Mock function to simulate triggering an email edge function
 */
export const triggerEmailNotification = async (email, invoiceUrl) => {
  console.log(`[Mock] Sending email to ${email} with invoice link: ${invoiceUrl}`);
  return { success: true, message: "Email sent successfully" };
};
