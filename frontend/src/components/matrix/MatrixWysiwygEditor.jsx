import React, { useState, useEffect } from 'react';
import { getRolesApi } from '../../api/users.api';

export default function MatrixWysiwygEditor({
  questions = [],
  onChange,
  isLocked = false,
}) {
  const [dbRoles, setDbRoles] = useState([]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await getRolesApi();
        if (res.success) {
          setDbRoles(res.data);
        }
      } catch (err) {
        console.warn('Could not fetch roles for matrix editor:', err);
      }
    };
    fetchRoles();
  }, []);

  // We store the matrix inside the first question's options.matrix
  const matrixQ = questions.find(q => q.type === 'matrix') || {
    id: `q_${Date.now()}`,
    tempId: Date.now(),
    type: 'matrix',
    question_text: 'Matrix Rubric',
    is_required: true,
    options: {
      matrix: {
        groups: [
          {
            id: `g_${Date.now()}`,
            name: 'I. Nhóm Tiêu Chí Mới',
            maxScore: 100,
            items: [
              {
                id: `i_${Date.now()}`,
                name: '1. Tiêu chí 1',
                maxScore: 20,
              },
            ],
          },
        ],
        columns: [
          {
            id: `c_${Date.now()}_1`,
            name: 'Sinh viên tự chấm',
            role: 'SINH_VIEN',
            isInputColumn: true,
            inputType: 'number',
          },
          {
            id: `c_${Date.now()}_2`,
            name: 'Giảng viên chấm',
            role: 'GIANG_VIEN',
            isInputColumn: true,
            inputType: 'number',
          },
        ],
      }
    }
  };

  const matrix = matrixQ.options.matrix;

  // Data migration for dynamic max score and total row (Only run once on mount for backward compatibility)
  const [hasMigrated, setHasMigrated] = React.useState(false);

  React.useEffect(() => {
    if (isLocked || !matrix || hasMigrated) return;
    let needsUpdate = false;
    let newMatrix = { ...matrix };
    
    if (newMatrix.showGrandTotal === undefined) {
      newMatrix.showGrandTotal = true;
      needsUpdate = true;
    }
    
    if (!newMatrix.columns?.some(col => col.isMaxScoreColumn)) {
      newMatrix.columns = [
        { id: `c_max_score_auto`, name: 'Điểm tối đa', isMaxScoreColumn: true },
        ...(newMatrix.columns || [])
      ];
      needsUpdate = true;
    }

    if (needsUpdate) {
      onChange([{
        ...matrixQ,
        options: { ...matrixQ.options, matrix: newMatrix }
      }]);
    }
    setHasMigrated(true);
  }, [matrix, isLocked, matrixQ, onChange, hasMigrated]);

  const updateMatrix = (newMatrix) => {
    if (isLocked) return;
    const newQuestions = [
      {
        ...matrixQ,
        options: {
          ...matrixQ.options,
          matrix: newMatrix,
        }
      }
    ];
    onChange(newQuestions);
  };

  // ---- Group Actions ----
  const handleAddGroup = () => {
    if (isLocked) return;
    const newGroup = {
      id: `g_${Date.now()}`,
      name: 'Nhóm tiêu chí mới',
      maxScore: 100,
      items: [
        {
          id: `i_${Date.now()}`,
          name: 'Tiêu chí 1',
          maxScore: 10,
        },
      ],
    };
    updateMatrix({ ...matrix, groups: [...matrix.groups, newGroup] });
  };

  const handleUpdateGroup = (gIdx, field, value) => {
    if (isLocked) return;
    const newGroups = [...matrix.groups];
    newGroups[gIdx] = { ...newGroups[gIdx], [field]: value };
    updateMatrix({ ...matrix, groups: newGroups });
  };

  const handleUpdateGroupAdminContent = (gIdx, colId, value) => {
    if (isLocked) return;
    const newGroups = [...matrix.groups];
    const group = newGroups[gIdx];
    const newAdminContent = { ...(group.adminContent || {}), [colId]: value };
    newGroups[gIdx] = { ...group, adminContent: newAdminContent };
    updateMatrix({ ...matrix, groups: newGroups });
  };

  const handleRemoveGroup = (gIdx) => {
    if (isLocked) return;
    const newGroups = matrix.groups.filter((_, i) => i !== gIdx);
    updateMatrix({ ...matrix, groups: newGroups });
  };

  // ---- Item Actions ----
  const handleAddItem = (gIdx) => {
    if (isLocked) return;
    const newGroups = [...matrix.groups];
    newGroups[gIdx].items.push({
      id: `i_${Date.now()}`,
      name: 'Tiêu chí mới',
      maxScore: 10,
    });
    updateMatrix({ ...matrix, groups: newGroups });
  };

  const handleUpdateItem = (gIdx, iIdx, field, value) => {
    if (isLocked) return;
    const newGroups = [...matrix.groups];
    newGroups[gIdx].items[iIdx] = { ...newGroups[gIdx].items[iIdx], [field]: value };
    updateMatrix({ ...matrix, groups: newGroups });
  };

  const handleUpdateItemAdminContent = (gIdx, iIdx, colId, value) => {
    if (isLocked) return;
    const newGroups = [...matrix.groups];
    const item = newGroups[gIdx].items[iIdx];
    const newAdminContent = { ...(item.adminContent || {}), [colId]: value };
    newGroups[gIdx].items[iIdx] = { ...item, adminContent: newAdminContent };
    updateMatrix({ ...matrix, groups: newGroups });
  };

  const handleRemoveItem = (gIdx, iIdx) => {
    if (isLocked) return;
    const newGroups = [...matrix.groups];
    newGroups[gIdx].items = newGroups[gIdx].items.filter((_, i) => i !== iIdx);
    updateMatrix({ ...matrix, groups: newGroups });
  };

  // ---- Column Actions ----
  const [showRolePopover, setShowRolePopover] = useState(null);

  const handleAddColumn = () => {
    if (isLocked) return;
    const newCol = {
      id: `c_${Date.now()}`,
      name: 'Đối tượng chấm mới',
      role: 'ROLE_NEW',
      isInputColumn: true,
      inputType: 'number',
    };
    updateMatrix({ ...matrix, columns: [...matrix.columns, newCol] });
  };

  const handleUpdateColumnFields = (cIdx, updates) => {
    if (isLocked) return;
    const newCols = [...matrix.columns];
    newCols[cIdx] = { ...newCols[cIdx], ...updates };
    updateMatrix({ ...matrix, columns: newCols });
  };

  const handleUpdateColumn = (cIdx, field, value) => {
    handleUpdateColumnFields(cIdx, { [field]: value });
  };

  const handleRemoveColumn = (cIdx) => {
    if (isLocked) return;
    const newCols = matrix.columns.filter((_, i) => i !== cIdx);
    updateMatrix({ ...matrix, columns: newCols });
  };

  return (
    <div className="w-full relative space-y-4">
      
      {/* Paper Container */}
      <div className="overflow-x-auto pb-6">
        <table className="w-full text-left text-sm border-collapse border border-slate-300 bg-white rounded-lg shadow-2xs">
          <thead>
            <tr className="bg-gray-100/50 text-gray-700">
              <th className="p-3 border border-slate-300 font-bold w-1/3 min-w-[200px]">
                Nội dung đánh giá
              </th>
              {matrix?.columns?.map((col, cIdx) => (
                <th key={col.id} className={`p-0 border border-slate-300 font-bold text-center relative group min-w-[140px] ${col.isMaxScoreColumn ? 'w-24' : ''}`}>
                  <div className="p-2 h-full w-full flex flex-col justify-center items-center relative overflow-hidden min-w-[140px]" style={{ resize: 'horizontal', overflow: 'hidden' }}>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={col.name}
                      onChange={(e) => handleUpdateColumn(cIdx, 'name', e.target.value)}
                      placeholder="Tên đối tượng"
                      className="bg-transparent border-none outline-none hover:bg-slate-50 w-full text-center font-bold text-slate-800 focus:ring-1 focus:ring-slate-300 rounded"
                    />
                    
                    <div className="relative mt-1 flex items-center justify-center w-full">
                      <button
                        type="button"
                        onClick={() => !isLocked && setShowRolePopover(showRolePopover === col.id ? null : col.id)}
                        className={`text-[10px] font-bold uppercase p-1.5 rounded transition cursor-pointer flex items-center justify-center mx-auto mt-1 w-7 h-7 ${
                          col.isMaxScoreColumn ? 'text-amber-700 bg-amber-100 border border-amber-300 hover:bg-amber-200 shadow-sm' :
                          col.isInputColumn === false ? 'text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 shadow-sm' :
                          col.inputType === 'text' ? 'text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 shadow-sm' : 'text-blue-700 bg-blue-100 border border-blue-300 hover:bg-blue-200 shadow-sm'
                        }`}
                        title="Cấu hình Cột"
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>
                  
                  {/* Role Popover (Moved outside overflow-hidden div to prevent clipping) */}
                  {showRolePopover === col.id && !isLocked && (
                    <div className="absolute top-full mt-2 w-64 bg-white border border-slate-200 shadow-2xl rounded-lg p-4 z-50 left-1/2 -translate-x-1/2 flex flex-col gap-3">
                      <div>
                        <label className="text-xs text-slate-600 font-bold block mb-1 text-left">Mục đích của cột này:</label>
                        <div className="flex flex-col gap-1.5 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input 
                              type="radio" 
                              name={`colType_${col.id}`}
                              checked={col.isInputColumn !== false && !col.isMaxScoreColumn}
                              onChange={() => handleUpdateColumnFields(cIdx, { isInputColumn: true, isMaxScoreColumn: false })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            Dành cho Người dùng nhập liệu
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input 
                              type="radio" 
                              name={`colType_${col.id}`}
                              checked={col.isInputColumn === false && !col.isMaxScoreColumn}
                              onChange={() => handleUpdateColumnFields(cIdx, { isInputColumn: false, isMaxScoreColumn: false })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            Dành cho Admin (Hiển thị tĩnh)
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input 
                              type="radio" 
                              name={`colType_${col.id}`}
                              checked={col.isMaxScoreColumn === true}
                              onChange={() => handleUpdateColumnFields(cIdx, { isMaxScoreColumn: true, isInputColumn: false, inputType: 'number' })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            Là cột Điểm Tối Đa
                          </label>
                        </div>
                      </div>

                      {col.isInputColumn !== false && !col.isMaxScoreColumn && (
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <label className="text-xs text-slate-600 font-bold block mb-1 text-left">Người dùng sẽ nhập:</label>
                          <select
                            value={col.inputType || 'number'}
                            onChange={(e) => handleUpdateColumn(cIdx, 'inputType', e.target.value)}
                            className="text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full bg-white cursor-pointer"
                          >
                            <option value="number">Nhập điểm (Số)</option>
                            <option value="text">Nhập nhận xét (Chữ)</option>
                          </select>
                          
                          <label className="text-xs text-slate-600 font-bold block mb-1 mt-3 text-left">Mã Role (Quyền nhập liệu):</label>
                          <select
                            value={col.role || ''}
                            onChange={(e) => handleUpdateColumn(cIdx, 'role', e.target.value)}
                            className="text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full text-left bg-white cursor-pointer"
                          >
                            <option value="">-- Chọn quyền (Tùy chọn) --</option>
                            {dbRoles.map((role, idx) => (
                              <option key={idx} value={role.code || role.id || role}>
                                {role.name || role.code || role}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowRolePopover(null)}
                        className="bg-blue-600 text-white text-xs font-bold py-2 rounded-md hover:bg-blue-700 transition mt-1"
                      >
                        Lưu cấu hình
                      </button>
                    </div>
                  )}

                  {/* Delete Column Hover Button */}
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(cIdx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 text-[10px]"
                      title="Xóa cột"
                    >
                      ✕
                    </button>
                  )}
                </th>
              ))}
              <th className="w-10 p-0 text-center align-middle bg-slate-50 border border-slate-300">
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="w-full h-full p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition font-bold text-lg"
                    title="Thêm đối tượng chấm"
                  >
                    +
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((group, gIdx) => (
              <React.Fragment key={group.id}>
                {/* Group Row (Level 1) */}
                <tr className="bg-slate-100 border border-slate-300 group/row relative">
                  <td className="border border-slate-300 p-0 relative">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={group.name}
                      onChange={(e) => handleUpdateGroup(gIdx, 'name', e.target.value)}
                      placeholder="Tên Nhóm Tiêu chí..."
                      className="bg-transparent border-none outline-none hover:bg-slate-200/50 w-full font-bold text-slate-800 px-3 py-3 focus:ring-1 focus:ring-slate-300"
                    />
                    
                    {/* Add Item Button & Delete Group Button on Hover */}
                    {!isLocked && (
                      <div className="absolute left-0 top-full mt-0 opacity-0 group-hover/row:opacity-100 transition flex items-center gap-2 z-10 pl-3">
                        <button
                          type="button"
                          onClick={() => handleAddItem(gIdx)}
                          className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow hover:bg-emerald-600"
                        >
                          + Thêm mục con
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(gIdx)}
                          className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow hover:bg-red-600"
                          title="Xóa nhóm"
                        >
                          ✕ Xóa nhóm
                        </button>
                      </div>
                    )}
                  </td>
                  {matrix?.columns?.map((col) => (
                    <td key={`group_col_${col.id}`} className="bg-slate-50/50 border border-slate-300 text-center align-middle p-1">
                      {col.isMaxScoreColumn ? (
                        <input
                          type="number"
                          disabled={isLocked}
                          value={group.maxScore}
                          onChange={(e) => handleUpdateGroup(gIdx, 'maxScore', Number(e.target.value))}
                          className="bg-transparent border-none outline-none hover:bg-slate-200/50 w-full font-bold text-slate-800 text-center py-2 focus:ring-1 focus:ring-slate-300"
                        />
                      ) : col.isInputColumn === false ? (
                        <textarea
                          disabled={isLocked}
                          value={group.adminContent?.[col.id] || ''}
                          onChange={(e) => handleUpdateGroupAdminContent(gIdx, col.id, e.target.value)}
                          placeholder="Nhập nội dung tĩnh (tùy chọn)"
                          rows={1}
                          className="bg-transparent border-none outline-none hover:bg-white w-full text-slate-700 text-xs px-2 py-1.5 focus:ring-1 focus:ring-slate-300 resize-y rounded"
                        />
                      ) : col.inputType === 'number' ? (
                        <span className="text-[10px] text-slate-400 font-semibold italic bg-slate-100 px-1.5 py-0.5 rounded">Tự động (Auto-Sum)</span>
                      ) : null}
                    </td>
                  ))}
                  <td className="border border-slate-300 bg-slate-50"></td>
                </tr>

                {/* Items Rows (Level 2) */}
                {group.items?.map((item, iIdx) => (
                  <tr key={item.id} className="bg-white border border-slate-300 group/item relative">
                    <td className="border border-slate-300 p-0 pl-6 relative">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={item.name}
                        onChange={(e) => handleUpdateItem(gIdx, iIdx, 'name', e.target.value)}
                        placeholder="Tiêu chí con..."
                        className="bg-transparent border-none outline-none hover:bg-slate-50 w-full text-slate-700 px-3 py-2.5 focus:ring-1 focus:ring-slate-200"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(gIdx, iIdx)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 opacity-0 group-hover/item:opacity-100 transition text-xs"
                          title="Xóa tiêu chí"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                    {matrix?.columns?.map((col) => (
                      <td key={col.id} className="border border-slate-300 text-center align-middle bg-gray-50/30 p-1">
                        {col.isMaxScoreColumn ? (
                          <input
                            type="number"
                            disabled={isLocked}
                            value={item.maxScore}
                            onChange={(e) => handleUpdateItem(gIdx, iIdx, 'maxScore', Number(e.target.value))}
                            className="bg-transparent border-none outline-none hover:bg-slate-50 w-full text-center text-slate-600 font-medium py-2 focus:ring-1 focus:ring-slate-200"
                          />
                        ) : col.isInputColumn === false ? (
                          <textarea
                            disabled={isLocked}
                            value={item.adminContent?.[col.id] || ''}
                            onChange={(e) => handleUpdateItemAdminContent(gIdx, iIdx, col.id, e.target.value)}
                            placeholder="Nhập nội dung (VD: Yêu cầu...)"
                            rows={1}
                            className="bg-transparent border-none outline-none hover:bg-white w-full text-slate-700 text-xs px-2 py-1.5 focus:ring-1 focus:ring-slate-300 resize-y rounded"
                          />
                        ) : col.inputType === 'text' ? (
                          <span className="text-gray-400 text-[10px] italic font-semibold border border-dashed border-gray-300 px-2 py-1 rounded bg-gray-50">[Nhập chữ]</span>
                        ) : (
                          <span className="text-gray-400 text-[10px] italic font-semibold border border-dashed border-gray-300 px-2 py-1 rounded bg-gray-50">[Nhập điểm]</span>
                        )}
                      </td>
                    ))}
                    <td className="border border-slate-300 bg-white"></td>
                  </tr>
                ))}
                
                {/* Spacer row for visual separation after items, especially useful when hovering for + buttons */}
                <tr className="h-4"></tr>
              </React.Fragment>
            ))}
          </tbody>
          
          {/* TFOOT: Hàng Tổng Cộng Cuối Bảng (Grand Total Row) */}
          {matrix?.showGrandTotal && (
            <tfoot className="bg-slate-200/60 font-bold text-slate-800 border-t-2 border-slate-400">
              <tr>
                <td className="border border-slate-300 p-4 text-right uppercase text-xs tracking-wider">
                  Tổng cộng
                </td>
                {matrix?.columns?.map((col) => (
                  <td key={`total_col_${col.id}`} className="border border-slate-300 p-4 text-center">
                    {col.isMaxScoreColumn ? (
                      isLocked ? (
                        <span className="text-blue-700">
                          {matrix.grandTotalMaxScore !== undefined && matrix.grandTotalMaxScore !== ''
                            ? Number(matrix.grandTotalMaxScore)
                            : matrix.groups.reduce((acc, g) => acc + (Number(g.maxScore) || 0), 0)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={matrix.grandTotalMaxScore !== undefined ? matrix.grandTotalMaxScore : matrix.groups.reduce((acc, g) => acc + (Number(g.maxScore) || 0), 0)}
                          onChange={(e) => updateMatrix({ ...matrix, grandTotalMaxScore: e.target.value === '' ? '' : Number(e.target.value) })}
                          title="Để trống sẽ tự động cộng tổng Điểm Tối Đa của các nhóm"
                          className="w-16 p-1 text-center font-bold text-blue-700 bg-transparent border-b border-blue-300 hover:border-blue-500 focus:outline-none focus:border-blue-600 transition-colors"
                        />
                      )
                    ) : col.isInputColumn !== false && col.inputType === 'number' ? (
                      <span className="text-xs text-blue-700 italic">Tổng điểm auto</span>
                    ) : null}
                  </td>
                ))}
                <td className="border border-slate-300"></td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Add Group Button Bottom */}
        {!isLocked && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleAddGroup}
              className="flex items-center justify-center gap-2 w-full max-w-sm py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:text-blue-600 text-slate-500 font-semibold rounded-lg transition"
            >
              <span>+</span>
              <span>Thêm Nhóm Tiêu chí mới</span>
            </button>
          </div>
        )}

        {/* Cấu hình thêm (Bật/tắt Tổng cộng & Nhận xét theo từng cấp) */}
        {!isLocked && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 px-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
              <input 
                type="checkbox" 
                checked={matrix?.showGrandTotal !== false}
                onChange={(e) => updateMatrix({ ...matrix, showGrandTotal: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              Hiển thị hàng Tổng cộng cuối bảng
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
              <input 
                type="checkbox" 
                checked={matrix?.showLevelComments !== false}
                onChange={(e) => updateMatrix({ ...matrix, showLevelComments: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              💬 Cho phép để lại ý kiến nhận xét theo từng cấp duyệt
            </label>
          </div>
        )}

        {/* Xem trước phần ý kiến nhận xét theo từng cấp trong Editor */}
        {matrix?.showLevelComments !== false && (
          <div className="mt-6 text-slate-600 text-sm">
            <div className="flex items-center gap-2 font-bold text-slate-700 mb-3 text-xs uppercase tracking-wider">
              <span>💬</span>
              <span>Ý kiến nhận xét theo từng cấp duyệt (Hiển thị bên dưới bảng điểm)</span>
            </div>
            <div className="flex flex-col space-y-3">
              {matrix?.columns?.filter(c => c.isInputColumn !== false && !c.isMaxScoreColumn).map((col, idx) => (
                <div key={col.id} className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-xs text-slate-800">{col.name}</span>
                    </div>
                    {col.role && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{col.role}</span>}
                  </div>
                  <div className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded border border-dashed border-slate-200">
                    [Ô nhập ý kiến nhận xét và thông tin người duyệt của {col.name}]
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
