import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useRef } from "react";
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote,
  Heading2, Heading3, Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2, Minus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateAndCompress } from "@/lib/image-upload";
import { toast } from "sonner";

function Btn({
  onClick, active, disabled, children, title,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  children: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40 ${
        active ? "bg-primary/15 text-primary" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Product er bistarito description likhun…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3], HTMLAttributes: { class: "font-semibold" } },
        bulletList: { HTMLAttributes: { class: "list-disc pl-6 my-2" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-6 my-2" } },
        listItem: { HTMLAttributes: { class: "my-1" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-muted pl-3 italic my-2" } },
      }),
      Image.configure({ HTMLAttributes: { class: "rounded-md my-2 max-w-full h-auto" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "max-w-none min-h-[220px] px-3 py-3 focus:outline-none text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  async function insertImage(files: FileList | null) {
    if (!files?.length || !editor) return;
    try {
      const f = files[0];
      const compressed = await validateAndCompress(f);
      const path = `descriptions/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, compressed.blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed?.signedUrl) {
        editor.chain().focus().setImage({ src: signed.signedUrl }).run();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image insert failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const e = editor as Editor;

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        <Btn title="Heading 2" onClick={() => e.chain().focus().toggleHeading({ level: 2 }).run()} active={e.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="Heading 3" onClick={() => e.chain().focus().toggleHeading({ level: 3 }).run()} active={e.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bold" onClick={() => e.chain().focus().toggleBold().run()} active={e.isActive("bold")}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" onClick={() => e.chain().focus().toggleItalic().run()} active={e.isActive("italic")}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Strike" onClick={() => e.chain().focus().toggleStrike().run()} active={e.isActive("strike")}><Strikethrough className="h-4 w-4" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bullet list" onClick={() => e.chain().focus().toggleBulletList().run()} active={e.isActive("bulletList")}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" onClick={() => e.chain().focus().toggleOrderedList().run()} active={e.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="Quote" onClick={() => e.chain().focus().toggleBlockquote().run()} active={e.isActive("blockquote")}><Quote className="h-4 w-4" /></Btn>
        <Btn title="Divider" onClick={() => e.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn title="Link" onClick={addLink} active={e.isActive("link")}><LinkIcon className="h-4 w-4" /></Btn>
        <Btn title="Image" onClick={() => fileRef.current?.click()}><ImageIcon className="h-4 w-4" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn title="Undo" onClick={() => e.chain().focus().undo().run()} disabled={!e.can().undo()}><Undo2 className="h-4 w-4" /></Btn>
        <Btn title="Redo" onClick={() => e.chain().focus().redo().run()} disabled={!e.can().redo()}><Redo2 className="h-4 w-4" /></Btn>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(ev) => insertImage(ev.target.files)}
      />
    </div>
  );
}
