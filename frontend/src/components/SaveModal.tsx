import { useState } from "react";

interface Props {
  initialName?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export default function SaveModal({ initialName, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName || "");

  return (
    <div className="iptv-dialog-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Save playlist</h3>
        <input
          type="text"
          autoFocus
          placeholder="Playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim());
          }}
        />
        <div className="actions">
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
