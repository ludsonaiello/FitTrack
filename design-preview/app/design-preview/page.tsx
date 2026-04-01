"use client";

import { useState, useRef, useEffect } from "react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface SetRow {
  id: number;
  weight: string;
  reps: string;
  completed: boolean;
}

interface TabItem {
  label: string;
  id: string;
}

const TABS: TabItem[] = [
  { label: "Track", id: "track" },
  { label: "Overview", id: "overview" },
  { label: "History", id: "history" },
  { label: "Notes", id: "notes" },
];

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function DesignPreviewPage() {
  return (
    <div
      className="min-h-screen flex items-start justify-center py-10 px-4"
      style={{ background: "#0D0D0D" }}
    >
      <MobileFrame />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Mobile Frame
───────────────────────────────────────────── */
function MobileFrame() {
  return (
    <div
      style={{
        width: 375,
        minHeight: 812,
        background: "var(--color-bg-base)",
        borderRadius: 40,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ExerciseTrackingScreen />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Exercise Tracking Screen
───────────────────────────────────────────── */
function ExerciseTrackingScreen() {
  const [activeTab, setActiveTab] = useState("track");
  const [sets, setSets] = useState<SetRow[]>([
    { id: 1, weight: "100", reps: "12", completed: false },
    { id: 2, weight: "100", reps: "10", completed: false },
    { id: 3, weight: "95", reps: "10", completed: false },
    { id: 4, weight: "90", reps: "8", completed: false },
  ]);
  const [nextId, setNextId] = useState(5);

  const completedCount = sets.filter((s) => s.completed).length;
  const totalVolume = sets
    .filter((s) => s.completed)
    .reduce((acc, s) => acc + parseFloat(s.weight || "0") * parseFloat(s.reps || "0"), 0);
  const maxWeight = sets
    .filter((s) => s.completed)
    .reduce((acc, s) => Math.max(acc, parseFloat(s.weight || "0")), 0);

  function toggleComplete(id: number) {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  }

  function updateSet(id: number, field: "weight" | "reps", value: string) {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function addSet() {
    setSets((prev) => [
      ...prev,
      { id: nextId, weight: "", reps: "", completed: false },
    ]);
    setNextId((n) => n + 1);
  }

  const canComplete = completedCount > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-bg-base)",
      }}
    >
      {/* Top Bar */}
      <TopBar />

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {/* Hero Image */}
        <HeroImage />

        {/* Exercise Info */}
        <ExerciseInfo />

        {/* Sets */}
        <div style={{ padding: "0 16px" }}>
          {sets.map((set, index) => (
            <SetRowComponent
              key={set.id}
              set={set}
              index={index}
              onToggle={() => toggleComplete(set.id)}
              onWeightChange={(v) => updateSet(set.id, "weight", v)}
              onRepsChange={(v) => updateSet(set.id, "reps", v)}
            />
          ))}
        </div>

        {/* Volume Summary */}
        {completedCount > 0 && (
          <VolumeSummary
            totalVolume={totalVolume}
            setsDone={completedCount}
            maxWeight={maxWeight}
          />
        )}

        {/* Add Set */}
        <AddSetButton onAdd={addSet} />

        {/* Complete CTA */}
        <CompleteButton enabled={canComplete} />

        {/* Bottom padding */}
        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Top Bar
───────────────────────────────────────────── */
function TopBar() {
  return (
    <div
      style={{
        height: 56,
        background: "var(--color-bg-surface)",
        borderBottom: "1px solid var(--color-border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
      }}
    >
      {/* Back arrow */}
      <button
        aria-label="Go back"
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-primary)",
          borderRadius: "var(--radius-full)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>

      {/* Title */}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "0.01em",
          flex: 1,
          textAlign: "center",
        }}
      >
        Machine Lat Pulldown
      </span>

      {/* Upgrade button */}
      <button
        style={{
          background: "rgba(255, 77, 77, 0.12)",
          border: "1px solid rgba(255, 77, 77, 0.35)",
          color: "#FF4D4D",
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "5px 10px",
          borderRadius: "var(--radius-full)",
          cursor: "pointer",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        Upgrade
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab Bar
───────────────────────────────────────────── */
function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(
      `[data-tab="${activeTab}"]`
    );
    if (!activeEl) return;
    setIndicatorStyle({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
    });
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        background: "var(--color-bg-surface)",
        borderBottom: "1px solid var(--color-border-subtle)",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              padding: "12px 4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive
                ? "var(--color-accent-primary)"
                : "var(--color-text-secondary)",
              transition: "color 150ms var(--ease-default)",
              letterSpacing: "0.01em",
            }}
          >
            {tab.label}
          </button>
        );
      })}

      {/* Sliding underline indicator */}
      <div
        style={{
          position: "absolute",
          bottom: -1,
          height: 2,
          background: "var(--color-accent-primary)",
          borderRadius: "2px 2px 0 0",
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transition: "left 280ms cubic-bezier(0.4, 0, 0.2, 1), width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Hero Image
───────────────────────────────────────────── */
function HeroImage() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        background: "linear-gradient(135deg, #1A1A1A 0%, #111111 100%)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px)",
        }}
      />

      {/* Placeholder icon */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60%",
          background:
            "linear-gradient(to top, rgba(10,10,10,0.92) 0%, transparent 100%)",
        }}
      />

      {/* Exercise name overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 16,
          right: 16,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 800,
            color: "var(--color-text-primary)",
            letterSpacing: "0.01em",
            lineHeight: 1.1,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          Machine Lat Pulldown
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Exercise Info Block
───────────────────────────────────────────── */
function ExerciseInfo() {
  return (
    <div
      style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          fontWeight: 700,
          color: "var(--color-text-primary)",
          marginBottom: 4,
          lineHeight: 1.2,
        }}
      >
        Machine Lat Pulldown
      </h2>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: 12,
        }}
      >
        Reps: 8–12 &nbsp;·&nbsp; Rest: 1 min
      </p>

      {/* Action pills */}
      <div style={{ display: "flex", gap: 8 }}>
        <ActionPill icon={<TimerIcon />} label="Timer" />
        <ActionPill icon={<StopwatchIcon />} label="Stopwatch" />
        <ActionPill icon={<VideoIcon />} label="Video" />
      </div>
    </div>
  );
}

function ActionPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-full)",
        padding: "7px 12px",
        cursor: "pointer",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-body)",
        fontSize: 12,
        fontWeight: 500,
        transition: "border-color 150ms, color 150ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--color-border-accent)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "var(--color-accent-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--color-border-default)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "var(--color-text-secondary)";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Set Row Component
───────────────────────────────────────────── */
function SetRowComponent({
  set,
  index,
  onToggle,
  onWeightChange,
  onRepsChange,
}: {
  set: SetRow;
  index: number;
  onToggle: () => void;
  onWeightChange: (v: string) => void;
  onRepsChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        marginBottom: 8,
        borderRadius: "var(--radius-sm)",
        border: set.completed
          ? "1px solid var(--color-border-accent)"
          : "1px solid var(--color-border-subtle)",
        overflow: "hidden",
        animation: `rowEnter 300ms var(--ease-decelerate) both`,
        animationDelay: `${index * 50}ms`,
        ...(set.completed
          ? { animation: `rowFlash 400ms var(--ease-default) both` }
          : {}),
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          background: set.completed
            ? "var(--color-accent-subtle)"
            : "var(--color-bg-surface)",
          transition: "background 400ms var(--ease-default)",
        }}
      >
        {/* Set label */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
            color: set.completed
              ? "var(--color-accent-primary)"
              : "var(--color-text-primary)",
            minWidth: 44,
            transition: "color 250ms",
          }}
        >
          Set {index + 1}
        </span>

        {/* Weight input group */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              value={set.weight}
              onChange={(e) => onWeightChange(e.target.value)}
              placeholder="0"
              aria-label={`Set ${index + 1} weight`}
              style={{
                width: "100%",
                background: "var(--color-bg-input)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px 8px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                textAlign: "center",
                outline: "none",
                transition: "border-color 150ms, box-shadow 150ms",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent-primary)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(0, 230, 118, 0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontFamily: "var(--font-body)",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--color-text-tertiary)",
                pointerEvents: "none",
              }}
            >
              lbs
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              color: "var(--color-text-tertiary)",
              textAlign: "center",
            }}
          >
            Last: 100 lbs
          </span>
        </div>

        {/* Reps input group */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ position: "relative" }}>
            <input
              type="number"
              value={set.reps}
              onChange={(e) => onRepsChange(e.target.value)}
              placeholder="0"
              aria-label={`Set ${index + 1} reps`}
              style={{
                width: "100%",
                background: "var(--color-bg-input)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                textAlign: "center",
                outline: "none",
                transition: "border-color 150ms, box-shadow 150ms",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent-primary)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(0, 230, 118, 0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontFamily: "var(--font-body)",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--color-text-tertiary)",
                pointerEvents: "none",
              }}
            >
              reps
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 10,
              color: "var(--color-text-tertiary)",
              textAlign: "center",
            }}
          >
            Last: 12 reps
          </span>
        </div>

        {/* Completion button */}
        <CompletionButton completed={set.completed} onToggle={onToggle} setIndex={index} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Completion Circle Button
───────────────────────────────────────────── */
function CompletionButton({
  completed,
  onToggle,
  setIndex,
}: {
  completed: boolean;
  onToggle: () => void;
  setIndex: number;
}) {
  return (
    <button
      aria-label={completed ? "Mark incomplete" : "Mark complete"}
      onClick={onToggle}
      style={{
        width: 36,
        height: 36,
        borderRadius: "var(--radius-full)",
        border: completed
          ? "2px solid var(--color-accent-primary)"
          : "2px solid var(--color-border-strong)",
        background: completed ? "var(--color-accent-primary)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 200ms, border-color 200ms",
      }}
    >
      {completed ? (
        <span
          style={{
            display: "block",
            animation: "checkSpring 250ms cubic-bezier(0.32, 0.72, 0, 1) both",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-inverse)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.05em",
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Volume Summary Strip
───────────────────────────────────────────── */
function VolumeSummary({
  totalVolume,
  setsDone,
  maxWeight,
}: {
  totalVolume: number;
  setsDone: number;
  maxWeight: number;
}) {
  return (
    <div
      style={{
        margin: "12px 16px",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-accent)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        display: "flex",
        justifyContent: "space-around",
        animation: "volumeIn 300ms var(--ease-decelerate) both",
      }}
    >
      <VolumeStat label="Total Volume" value={`${totalVolume.toLocaleString()}`} unit="lbs" />
      <div style={{ width: 1, background: "var(--color-border-subtle)" }} />
      <VolumeStat label="Sets Done" value={String(setsDone)} unit="sets" />
      <div style={{ width: 1, background: "var(--color-border-subtle)" }} />
      <VolumeStat label="Max Weight" value={String(maxWeight)} unit="lbs" />
    </div>
  );
}

function VolumeStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          color: "var(--color-text-tertiary)",
        }}
      >
        {unit}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Add Set Button
───────────────────────────────────────────── */
function AddSetButton({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: "4px 16px 12px" }}>
      <button
        onClick={onAdd}
        style={{
          width: "100%",
          padding: "13px",
          background: "transparent",
          border: "1.5px dashed var(--color-border-default)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
          transition: "border-color 150ms, color 150ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--color-accent-primary)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--color-accent-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--color-border-default)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--color-text-secondary)";
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add Set
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Complete Exercise CTA
───────────────────────────────────────────── */
function CompleteButton({ enabled }: { enabled: boolean }) {
  return (
    <div style={{ padding: "0 16px" }}>
      <button
        disabled={!enabled}
        style={{
          width: "100%",
          padding: "16px",
          background: enabled ? "var(--color-accent-primary)" : "rgba(0, 230, 118, 0.12)",
          border: "none",
          borderRadius: "var(--radius-full)",
          cursor: enabled ? "pointer" : "not-allowed",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          fontWeight: 700,
          color: enabled ? "var(--color-text-inverse)" : "rgba(0, 230, 118, 0.35)",
          letterSpacing: "0.03em",
          boxShadow: enabled ? "var(--shadow-glow-sm)" : "none",
          transition: "background 200ms, box-shadow 200ms, transform 100ms",
          opacity: enabled ? 1 : 0.6,
        }}
        onMouseDown={(e) => {
          if (enabled) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        Complete Exercise
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Icons (inline SVG)
───────────────────────────────────────────── */
function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function StopwatchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9V5M9 5h6" />
      <path d="M12 13l3-3" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
