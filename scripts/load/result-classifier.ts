export function isAcceptedMessageSuccess(
  pathname: string,
  method: "GET" | "POST",
  status: number,
  responseOk: boolean,
  payload: { accepted?: boolean; queued?: boolean }
): boolean {
  const isMessageSend = pathname.includes("/api/messages/threads/") && pathname.endsWith("/messages") && method === "POST";
  if (!isMessageSend) return responseOk;
  return responseOk || (status === 202 && Boolean(payload.accepted) && Boolean(payload.queued));
}
