import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import { mergeAttributes, Node } from '@tiptap/core';
import { Bold, Italic, Table as TableIcon, Columns, Rows, Trash2, SplitSquareHorizontal, Combine, Pointer, AlignLeft, AlignCenter, AlignRight, AlignJustify, ChevronDown, Maximize2 } from 'lucide-react';

const FillableInput = Node.create({
  name: 'fillableInput',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      'data-id': {
        default: null,
      },
      'data-type': {
        default: 'text',
      },
      'data-width': {
        default: '150px',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.fillable-input',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-type'] || 'text';
    let widthValue = HTMLAttributes['data-width'] || '150px';
    let label = '[Ô NHẬP LIỆU]';
    let extraClass = 'text-blue-600 bg-blue-50 border-blue-400';

    if (type === 'number') {
      label = '[Ô CHỮ SỐ]';
      extraClass = 'text-emerald-700 bg-emerald-50 border-emerald-400';
    } else if (type === 'date') {
      label = '[Ô NGÀY THÁNG]';
      extraClass = 'text-purple-700 bg-purple-50 border-purple-400';
    }

    // Đảm bảo có đuôi px hoặc % cho inline style
    if (widthValue !== '100%' && !widthValue.endsWith('px')) {
      // Compatibility code just in case old tailwind classes are present
      if (widthValue === 'w-24') widthValue = '100px';
      else if (widthValue === 'w-48') widthValue = '200px';
      else if (widthValue === 'w-96') widthValue = '400px';
      else if (widthValue === 'w-full') widthValue = '100%';
      else widthValue = '150px';
    }

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `fillable-input border-b px-2 py-1 mx-1 rounded-sm cursor-pointer inline-block text-center truncate ${extraClass}`,
        style: `width: ${widthValue}; max-width: 100%; transition: width 0.2s ease;`,
        contenteditable: 'false',
      }),
      label,
    ];
  },
});

const MenuBar = ({ editor }) => {
  const [showInputDropdown, setShowInputDropdown] = React.useState(false);
  const [pendingInputType, setPendingInputType] = React.useState('text');

  if (!editor) {
    return null;
  }

  const insertInput = () => {
    editor.chain().focus().insertContent({
      type: 'fillableInput',
      attrs: {
        'data-id': 'canvas-input-' + Date.now() + Math.floor(Math.random() * 1000),
        'data-type': pendingInputType,
        'data-width': '150px',
      },
    }).insertContent(' ').run();
    setShowInputDropdown(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 border-b border-gray-200 rounded-t-xl">
      <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          title="In đậm"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          title="In nghiêng"
        >
          <Italic size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          title="Căn trái"
        >
          <AlignLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          title="Căn giữa"
        >
          <AlignCenter size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          title="Căn phải"
        >
          <AlignRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
          title="Căn đều"
        >
          <AlignJustify size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
          title="Chèn bảng (3x3)"
        >
          <TableIcon size={18} /> <span className="text-xs font-medium">Chèn bảng</span>
        </button>
        
        {/* Table Actions (only active if inside a table) */}
        {editor.isActive('table') && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-amber-200 bg-amber-50 rounded-lg p-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().mergeCells().run()}
              disabled={!editor.can().mergeCells()}
              className="p-1.5 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Gộp ô (Merge Cells)"
            >
              <Combine size={18} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().splitCell().run()}
              disabled={!editor.can().splitCell()}
              className="p-1.5 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Chia ô (Split Cell)"
            >
              <SplitSquareHorizontal size={18} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              disabled={!editor.can().addColumnBefore()}
              className="p-1.5 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Thêm cột bên trái"
            >
              <Columns size={18} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              disabled={!editor.can().addColumnAfter()}
              className="p-1.5 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Thêm cột bên phải"
            >
              <Columns size={18} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              disabled={!editor.can().addRowBefore()}
              className="p-1.5 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Thêm dòng bên trên"
            >
              <Rows size={18} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              disabled={!editor.can().addRowAfter()}
              className="p-1.5 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Thêm dòng bên dưới"
            >
              <Rows size={18} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              disabled={!editor.can().deleteRow()}
              className="p-1.5 text-red-600 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Xóa dòng"
            >
              <Rows size={18} className="text-red-600" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              disabled={!editor.can().deleteColumn()}
              className="p-1.5 text-red-600 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Xóa cột"
            >
              <Columns size={18} className="text-red-600" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              disabled={!editor.can().deleteTable()}
              className="p-1.5 text-red-700 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Xóa bảng"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center relative">
        <button
          type="button"
          onClick={() => setShowInputDropdown(!showInputDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          <Pointer size={16} /> Chèn Ô Nhập Liệu <ChevronDown size={14} />
        </button>
        
        {showInputDropdown && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col p-4 overflow-hidden">
            <h4 className="font-semibold text-sm mb-3 border-b border-gray-100 pb-2">Chèn Ô Nhập Liệu</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Loại dữ liệu</label>
                <select 
                  className="w-full border border-gray-300 rounded-md text-sm p-2 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pendingInputType}
                  onChange={(e) => setPendingInputType(e.target.value)}
                >
                  <option value="text">Văn bản (Text)</option>
                  <option value="number">Chữ số (Number)</option>
                  <option value="date">Ngày tháng (Date)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={insertInput}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition-colors"
              >
                Xác nhận chèn
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InputBubbleMenu = ({ editor }) => {
  if (!editor) {
    return null;
  }

  // Get current width of selected node
  const activeNodeAttrs = editor.getAttributes('fillableInput');
  const currentWidthStr = activeNodeAttrs['data-width'] || '150px';
  // Parse numeric value if possible
  const currentWidthValue = currentWidthStr === '100%' ? 800 : parseInt(currentWidthStr) || 150;

  const [localWidth, setLocalWidth] = React.useState(currentWidthValue);

  // Đồng bộ state khi chọn ô khác
  React.useEffect(() => {
    setLocalWidth(currentWidthValue);
  }, [currentWidthValue]);

  // Cập nhật DOM trực tiếp để có cảm giác real-time mượt mà
  // Tránh gọi editor updateAttributes liên tục vì sẽ làm mất focus của thanh trượt
  const handleSliderChange = (e) => {
    const val = e.target.value;
    setLocalWidth(val);
    
    try {
      const { state, view } = editor;
      const { from } = state.selection;
      const domNode = view.nodeDOM(from);
      if (domNode && domNode.nodeType === 1 && domNode.classList.contains('fillable-input')) {
        domNode.style.width = `${val}px`;
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Lưu trạng thái chính thức vào Editor khi nhả chuột
  const commitWidthChange = (val) => {
    editor.chain().updateAttributes('fillableInput', { 'data-width': `${val}px` }).run();
  };

  return (
    <BubbleMenu 
      editor={editor} 
      shouldShow={({ editor }) => editor.isActive('fillableInput')}
      tippyOptions={{ duration: 100, placement: 'bottom' }}
    >
      <div 
        className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-700"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap">Độ rộng ô:</span>
        <input 
          type="range" 
          min="50" 
          max="800" 
          step="10"
          value={localWidth}
          onChange={handleSliderChange}
          onMouseUp={(e) => commitWidthChange(e.target.value)}
          onTouchEnd={(e) => commitWidthChange(e.target.value)}
          className="w-32 accent-blue-500"
        />
        <div className="flex items-center gap-1 border border-slate-600 bg-slate-900 rounded-md overflow-hidden">
          <input 
            type="number" 
            value={localWidth}
            onChange={handleSliderChange}
            onBlur={(e) => commitWidthChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitWidthChange(e.target.value);
            }}
            className="w-14 bg-transparent text-center text-sm outline-none px-1 py-1"
          />
          <span className="text-xs text-slate-400 pr-2">px</span>
        </div>
        <div className="w-px h-6 bg-slate-600 mx-1"></div>
        <button
          type="button"
          onClick={() => commitWidthChange('100%')}
          className="p-1.5 rounded-md hover:bg-slate-700 transition-colors text-slate-300 hover:text-white flex items-center gap-1"
          title="Mở rộng toàn dòng (100%)"
        >
          <Maximize2 size={16} /> <span className="text-xs font-medium">Toàn dòng</span>
        </button>
      </div>
    </BubbleMenu>
  );
};

export default function CanvasBuilder({ canvasHtml, setCanvasHtml }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'w-full border-collapse border border-black my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-black',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-black p-2 font-bold text-center',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-black p-2',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph', 'tableCell'],
      }),
      FillableInput,
    ],
    content: canvasHtml || '',
    onUpdate: ({ editor }) => {
      setCanvasHtml(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none min-h-[600px] p-8 bg-white border border-t-0 border-gray-200 rounded-b-xl max-w-none',
      },
    },
  });

  useEffect(() => {
    if (editor && canvasHtml !== editor.getHTML()) {
      editor.commands.setContent(canvasHtml || '');
    }
  }, [canvasHtml, editor]);

  return (
    <div className="w-full flex flex-col mt-4 bg-white rounded-xl shadow-sm border border-gray-200">
      <MenuBar editor={editor} />
      <InputBubbleMenu editor={editor} />
      <style>{`
        .tiptap table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .tiptap table td,
        .tiptap table th {
          min-width: 1em;
          border: 1px solid #000;
          padding: 8px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .tiptap table th {
          font-weight: bold;
          text-align: center;
        }
        .tiptap table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
        .tiptap table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #adf;
          pointer-events: none;
        }
        .tiptap p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
      `}</style>
      <div className="overflow-y-auto max-h-[800px] p-4 bg-slate-50">
        <div className="max-w-4xl mx-auto shadow-md">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
