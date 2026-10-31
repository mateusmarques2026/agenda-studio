"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { addDays, formatDate, zonedNow } from "@/lib/scheduling";
export function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-head">
          <div>
            <span className="eyebrow">AGENDA STUDIO</span>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Calendar({ date, onSelect }: { date: string; onSelect: (date: string) => void }) {
  const [month, setMonth] = useState(date.slice(0, 7));
  useEffect(() => setMonth(date.slice(0, 7)), [date]);
  const first = month + "-01";
  const offset = new Date(first + "T12:00:00Z").getUTCDay();
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const today = zonedNow().date;
  const max = addDays(today, 90);
  function move(delta: number) {
    const d = new Date(first + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
  }
  return (
    <div className="calendar">
      <div className="calendar-title">
        <strong>{formatDate(first, { month: "long", year: "numeric" })}</strong>
        <div>
          <button className="icon-button" onClick={() => move(-1)} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-button" onClick={() => move(1)} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
          <span className="weekday" key={i}>
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"empty" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = month + "-" + String(i + 1).padStart(2, "0");
          return (
            <button
              key={d}
              className={(d === date ? "selected " : "") + (d === today ? "today" : "")}
              disabled={d > max}
              aria-label={formatDate(d)}
              aria-pressed={d === date}
              onClick={() => onSelect(d)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
