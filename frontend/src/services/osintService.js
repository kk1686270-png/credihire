const runtimeApiBase = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://127.0.0.1:8000/api/v1';

function getApiBaseUrl(apiBaseUrl = runtimeApiBase) {
  return (apiBaseUrl || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
}

export async function analyzeDomainIntel(domainOrUrl, apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/domain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain_or_url: domainOrUrl.trim() }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Domain analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function analyzeUpiIntel(upiIdOrUri, contextText = '', apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/upi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upi_id_or_uri: upiIdOrUri.trim(),
      context_text: contextText ? contextText.trim() : null,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `UPI analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function analyzeForwardedMessage(rawMessage, apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/forwarded-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_message: rawMessage.trim() }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Forwarded message analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function downloadEvidenceDossierPdf(dossierPayload, apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/scam/evidence-dossier/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dossierPayload),
  });
  if (!response.ok) {
    throw new Error(`Failed to generate PDF dossier (Status ${response.status})`);
  }
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `credihire-cybercrime-evidence-${Date.now()}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(downloadUrl);
  return true;
}

export async function analyzeEmailHeader(rawHeader, apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/email-header`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_header: rawHeader.trim() }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Email header analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function analyzeDocumentMetadata({ fileName, fileBytesBase64 = null, textContent = null }, apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/document-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_name: fileName,
      file_bytes_base64: fileBytesBase64,
      text_content: textContent,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Document metadata analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function analyzeQrTrap(qrPayloadOrUri, contextText = '', apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/qr-trap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      qr_payload_or_uri: qrPayloadOrUri.trim(),
      context_text: contextText ? contextText.trim() : null,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `QR trap analysis failed with status ${response.status}`);
  }
  return response.json();
}

export async function analyzeCompanyCin(cinOrGstin, companyNameClaimed = '', apiBaseUrl) {
  const base = getApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${base}/osint/company-cin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cin_or_gstin: cinOrGstin.trim().toUpperCase(),
      company_name_claimed: companyNameClaimed ? companyNameClaimed.trim() : null,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Company CIN/GSTIN analysis failed with status ${response.status}`);
  }
  return response.json();
}
