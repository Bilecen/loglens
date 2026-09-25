import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { Modal } from "./Modal";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { useLocale } from "./i18n";

// Fotoğrafı tarayıcıda kare kırpıp küçült (256px, jpeg) → data-URI. DB'de birkaç KB kalır.
async function resizeToDataUrl(file, size = 256) {
  const dataUrl = await new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ProfileEditModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) { setName(user.name || ""); setAvatar(user.avatar || ""); setPassword(""); setErr(null); }
  }, [open, user]);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setAvatar(await resizeToDataUrl(file)); } catch { setErr(t("profileEdit.imageReadError")); }
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const patch = { name: name.trim() };
      if (password) patch.password = password;
      if (avatar !== (user.avatar || "")) patch.avatar = avatar; // değiştiyse gönder ("" = kaldır)
      updateUser(await api.updateMe(patch));
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("profileEdit.title")} size={420}
      footer={<>
        <button className="btn ghost" onClick={onClose}>{t("profileEdit.cancel")}</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? t("profileEdit.saving") : t("profileEdit.save")}</button>
      </>}>
      {/* Fotoğraf */}
      <div className="flex items-center gap-3.5 mb-1">
        <Avatar user={{ name, avatar }} size={68} className="!rounded-2xl" />
        <div className="flex flex-col gap-1.5">
          <label className="btn ghost sm cursor-pointer inline-flex">
            <Icon icon="lucide:image" size={13} /> {t("profileEdit.choosePhoto")}
            <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
          </label>
          {avatar && <button type="button" className="btn ghost sm danger" onClick={() => setAvatar("")}>{t("profileEdit.remove")}</button>}
        </div>
      </div>

      <label className="field-label">{t("profileEdit.nameLabel")}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("profileEdit.namePlaceholder")} />

      <label className="field-label">{t("profileEdit.passwordLabel")}</label>
      <input type="password" autoComplete="new-password" value={password}
        onChange={(e) => setPassword(e.target.value)} placeholder={t("profileEdit.passwordPlaceholder")} />

      {err && <div className="mt-3 bg-danger-soft text-danger rounded-[10px] px-3.5 py-2.5 text-[13px]">{err}</div>}
    </Modal>
  );
}
