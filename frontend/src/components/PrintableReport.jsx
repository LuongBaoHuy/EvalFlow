import React, { forwardRef } from 'react';

const PrintableReport = forwardRef(({ analytics, displayQuestionsAnalytics, selectedFilter, uniqueTargets, aiGoalEvaluation }, ref) => {
  const currentDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const completionRate = analytics?.total_assigned > 0
    ? Math.round((analytics.total_completed / analytics.total_assigned) * 100)
    : 0;

  let targetName = 'Tất cả đối tượng';
  if (selectedFilter && selectedFilter.targetId !== 'ALL') {
    const target = uniqueTargets?.find(t =>
      String(t.target_user_id) === String(selectedFilter.targetId) &&
      String(t.context_reference) === String(selectedFilter.context)
    );
    if (target) {
      targetName = `${target.target_name} ${target.context_reference ? `[${target.context_reference}]` : ''}`;
    } else {
      targetName = selectedFilter.targetId;
    }
  }

  // Calculate Overall Average Score (if there are rating/slider questions)
  let totalScore = 0;
  let countScore = 0;
  displayQuestionsAnalytics?.forEach(q => {
    if (q.type === 'rating' && q.average_rating) {
      totalScore += q.average_rating;
      countScore++;
    } else if (q.type === 'slider' && q.average_score) {
      totalScore += q.average_score;
      countScore++;
    }
  });
  const overallAverage = countScore > 0 ? (totalScore / countScore).toFixed(1) : null;

  return (
    <div className="hidden print:block" ref={ref}>
      {/* Print specific CSS */}
      <style type="text/css" media="print">
        {`
          @page { size: A4; margin: 20mm; }
          body { background: white; color: #000; font-family: "Times New Roman", "Liberation Serif", serif; }
          /* Hide all other things in the layout, ensure this takes full space */
          header, aside, nav, button, .no-print { display: none !important; }
        `}
      </style>

      <div className="w-full h-full text-black text-base" style={{ fontFamily: '"Times New Roman", "Liberation Serif", serif' }}>
        {/* Header - 2 Columns */}
        <div className="flex justify-between items-start mb-8 text-center">
          <div className="w-[45%]">
            <div className="font-bold uppercase">TRƯỜNG ĐẠI HỌC NAM CẦN THƠ</div>
            <div className="font-bold border-b border-black inline-block pb-1 px-4 uppercase">KHOA CÔNG NGHỆ THÔNG TIN</div>
          </div>
          <div className="w-[55%]">
            <div className="font-bold uppercase whitespace-nowrap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-bold border-b border-black inline-block pb-1 px-8">Độc lập - Tự do - Hạnh phúc</div>
            <div className="italic mt-2 text-sm">Ngày xuất báo cáo: {currentDate}</div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl font-bold uppercase tracking-tight">BÁO CÁO KẾT QUẢ ĐÁNH GIÁ</h1>
          <p className="font-bold text-lg">{analytics?.campaign_name}</p>
          <p className="italic">Đối tượng đánh giá: {targetName}</p>
        </div>

        {/* Overview Statistics (Table) */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-gray-800 text-center">
            <thead>
              <tr>
                <th className="border border-gray-800 p-2 font-bold">Số lượng phát ra</th>
                <th className="border border-gray-800 p-2 font-bold">Đã hoàn thành</th>
                <th className="border border-gray-800 p-2 font-bold">Tỷ lệ tham gia</th>
                <th className="border border-gray-800 p-2 font-bold">Điểm trung bình</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-800 p-2">{analytics?.total_assigned || 0}</td>
                <td className="border border-gray-800 p-2">{analytics?.total_completed || 0}</td>
                <td className="border border-gray-800 p-2">{completionRate}%</td>
                <td className="border border-gray-800 p-2">{overallAverage !== null ? overallAverage : (analytics?.total_responses || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 1 - Goal Evaluation */}
        {aiGoalEvaluation && aiGoalEvaluation.goals && aiGoalEvaluation.goals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 uppercase">I. ĐÁNH GIÁ MỤC TIÊU ĐỀ RA</h2>
            <div className="space-y-4">
              {aiGoalEvaluation.goals.map((goal, idx) => (
                <div key={idx} className="print:break-inside-avoid">
                  <p className="font-bold">
                    {idx + 1}. {goal.goal} - <span className="uppercase">{goal.status}</span>
                  </p>
                  <p className="ml-4 mt-1 text-gray-800">
                    {goal.insight}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2 - Detailed Survey Results */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 uppercase">II. CHI TIẾT SỐ LIỆU</h2>
          <div className="space-y-6">
            {displayQuestionsAnalytics?.map((q, idx) => (
              <div key={q.question_id || idx} className="print:break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="font-bold mb-2">
                  Câu {idx + 1}: {q.question_text}
                </h3>
                
                <div className="ml-4">
                  {q.type === 'radio' || q.type === 'checkbox' ? (
                    <div className="space-y-1">
                      {Object.entries(q.breakdown || {}).map(([choice, count]) => (
                        <div key={choice} className="flex">
                          <span className="mr-4">- {choice}:</span>
                          <span>{count} lượt</span>
                        </div>
                      ))}
                    </div>
                  ) : q.type === 'rating' ? (
                    <div>
                      - Điểm trung bình: <span className="font-bold">{q.average_rating}</span> / {q.max_stars}
                    </div>
                  ) : q.type === 'slider' ? (
                    <div>
                      - Điểm trung bình: <span className="font-bold">{q.average_score}</span>
                    </div>
                  ) : q.type === 'text' ? (
                    <div className="space-y-1">
                      <p className="italic underline">Một số ý kiến tiêu biểu:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {q.text_responses?.slice(0, 5).map((txt, tIdx) => (
                          <li key={tIdx} className="italic">
                            "{txt.length > 150 ? txt.substring(0, 150) + '...' : txt}"
                          </li>
                        ))}
                        {!q.text_responses?.length && (
                          <li className="italic text-gray-600">Chưa có ý kiến phản hồi.</li>
                        )}
                      </ul>
                    </div>
                  ) : q.type === 'matrix' ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-4 text-xs">
                        {Object.entries(q.matrix_analytics?.avgByColumn || {}).map(([colId, avg]) => {
                          const colName = q.matrix_analytics?.matrix?.columns?.find((c) => c.id === colId)?.name || colId;
                          return (
                            <div key={colId} className="bg-gray-100 px-2.5 py-1 rounded">
                              <span className="font-semibold">{colName}: </span>
                              <span className="font-bold">{avg} điểm TB</span>
                            </div>
                          );
                        })}
                      </div>
                      {q.matrix_analytics?.comments?.length > 0 && (
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">Nhận xét tiêu biểu:</p>
                          <ul className="list-disc pl-5 space-y-0.5 text-gray-700 italic">
                            {q.matrix_analytics.comments.slice(0, 3).map((cm, cIdx) => (
                              <li key={cIdx}>
                                <strong>{cm.authorName || 'Người đánh giá'}:</strong> &ldquo;{cm.text}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="italic text-gray-600">Dữ liệu dạng: {q.type}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-12 pt-20 print:break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
          <div className="flex justify-between text-center font-bold">
            <div className="w-1/2">
              <p>Người lập báo cáo</p>
              <p className="font-normal italic mt-1">(Ký và ghi rõ họ tên)</p>
            </div>
            <div className="w-1/2">
              <p>Thủ trưởng đơn vị</p>
              <p className="font-normal italic mt-1">(Ký, ghi rõ họ tên và đóng dấu)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PrintableReport;
