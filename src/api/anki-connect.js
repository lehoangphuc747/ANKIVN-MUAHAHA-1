// src/api/anki-connect.js
const ANKI_CONNECT_URL = "http://localhost:8765";
const ANKI_CONNECT_VERSION = 6;

/**
 * Gửi yêu cầu đến Anki-Connect
 * @param {string} action - Tên action (vd: 'deckNames')
 * @param {object} params - Các tham số cho action
 * @returns {Promise<any>} - Kết quả từ Anki-Connect
 */
export async function invoke(action, params = {}) {
  console.log(`invoke: ${action}`, params);
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: action,
        version: ANKI_CONNECT_VERSION,
        params: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Anki-Connect error: ${data.error}`);
    }

    // console.log(`invoke success: ${action}`, data.result);
    return data.result;
  } catch (error) {
    console.error(`Error invoking Anki-Connect action '${action}':`, error);
    throw error;
  }
}