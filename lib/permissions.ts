export function matchesAdminEmail(
  email: string | undefined | null,
  configured: string | undefined | null,
) {
  return Boolean(
    email && configured && email.trim().toLowerCase() === configured.trim().toLowerCase(),
  );
}
export function canCancelOwnBooking(
  booking: { client_user_id: string | null; date: string; start: number; status: string },
  userId: string,
  now: { date: string; minute: number },
) {
  return (
    booking.client_user_id === userId &&
    booking.status === "confirmed" &&
    (booking.date > now.date || (booking.date === now.date && booking.start > now.minute))
  );
}
