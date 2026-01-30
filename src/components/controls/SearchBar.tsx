interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = "Search nodes...",
  resultCount,
}: SearchBarProps) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        minWidth: "280px",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ color: "#6B7280", flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: "none",
          background: "transparent",
          outline: "none",
          fontSize: "14px",
          color: "#374151",
          width: "100%",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "2px",
            color: "#6B7280",
            fontSize: "16px",
            lineHeight: 1,
          }}
        >
          &#10005;
        </button>
      )}
      {resultCount !== undefined && value && (
        <span
          style={{
            fontSize: "12px",
            color: resultCount > 0 ? "#10B981" : "#EF4444",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {resultCount} found
        </span>
      )}
    </div>
  );
};
