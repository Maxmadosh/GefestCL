const crypto = require("node:crypto");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const checklist = payload.checklist || {};
  const siteId = checklist.object?.siteId;
  const siteName = checklist.object?.siteName;
  if (!siteId || !siteName) {
    return json(400, { ok: false, error: "Missing site data" });
  }

  const id = [
    "gcl",
    new Date().toISOString().slice(0, 10).replaceAll("-", ""),
    crypto.randomBytes(4).toString("hex")
  ].join("-");

  const record = {
    id,
    receivedAt: new Date().toISOString(),
    appVersion: payload.appVersion,
    channel: payload.channel,
    site: { id: siteId, name: siteName },
    brigadier: {
      name: checklist.profile?.brigadierFullName,
      phone: checklist.profile?.phone,
      company: checklist.profile?.contractorCompany
    },
    summary: payload.summary,
    message: payload.message,
    checklist,
    pdfHtml: payload.pdfHtml,
    excelHtml: payload.excelHtml
  };

  const webhookUrl = process.env.REPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    return json(503, {
      ok: false,
      id,
      error: "REPORT_WEBHOOK_URL is not configured",
      preview: publicPreview(record)
    });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    return json(502, { ok: false, id, error: `Webhook HTTP ${response.status}` });
  }

  return json(200, { ok: true, id });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

function publicPreview(record) {
  return {
    id: record.id,
    receivedAt: record.receivedAt,
    site: record.site,
    brigadier: record.brigadier,
    summary: record.summary
  };
}
