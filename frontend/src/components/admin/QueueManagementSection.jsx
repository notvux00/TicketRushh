import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { eventApi } from "../../api/eventApi";
import { toast } from "../../lib/toast";

export default function QueueManagementSection({ showtimeId }) {
  const [threshold, setThreshold] = useState(200);
  const [batchSize, setBatchSize] = useState(50);
  const [simCount, setSimCount] = useState(50);
  const queryClient = useQueryClient();

  const { data: queueInfo, isLoading, isError } = useQuery({
    queryKey: ["admin-queue-info", showtimeId],
    queryFn: () => eventApi.adminGetQueueInfo(showtimeId),
    enabled: !!showtimeId,
    refetchInterval: 5000,
    placeholderData: (previousData) => previousData,
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (queueInfo?.threshold !== undefined) {
      setThreshold(queueInfo.threshold);
    }
    if (queueInfo?.batchSize !== undefined) {
      setBatchSize(queueInfo.batchSize);
    }
  }, [queueInfo?.threshold, queueInfo?.batchSize]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setThresholdMutation = useMutation({
    mutationFn: () => eventApi.adminSetQueueThreshold(showtimeId, threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      toast.success("Đã cập nhật ngưỡng kích hoạt!");
    }
  });

  const setBatchSizeMutation = useMutation({
    mutationFn: () => eventApi.adminSetBatchSize(showtimeId, batchSize),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      toast.success("Đã cập nhật số người vào mỗi đợt!");
    }
  });

  const simulateMutation = useMutation({
    mutationFn: () => eventApi.adminSimulateUsers(showtimeId, simCount),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      toast.success(`Đã thêm ${data.simulatedCount} user giả lập vào hàng chờ!`);
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => eventApi.adminResetQueue(showtimeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      toast.success("Đã reset hàng chờ!");
    }
  });

  return (
    <section className="space-y-4 bg-white rounded-3xl p-8 shadow-sm border border-border relative overflow-hidden min-h-[200px]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h4 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2 text-primary">
              <Activity className={`${isLoading ? 'animate-pulse' : ''} text-primary`} />
              Bộ điều khiển hàng chờ
            </h4>
            <p className="text-muted text-[11px] font-bold mt-1 uppercase tracking-wider">Chế độ demo & flash sale</p>
          </div>
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="px-4 py-2 bg-primary/5 hover:bg-primary text-primary hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border border-primary/20"
          >
            Đặt lại hàng chờ
          </button>
        </div>

        {isError ? (
          <div className="p-10 text-center bg-red-50 rounded-2xl border border-red-100">
            <p className="text-red-500 font-bold">Không thể lấy thông tin hàng chờ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Đang truy cập</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-primary">{queueInfo?.activeUsers ?? 0}</span>
                <span className="text-xs font-bold text-muted mb-1.5">User</span>
              </div>
            </div>

            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Kích hoạt Queue ở mức</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-3 py-1.5 text-base font-bold outline-none focus:border-primary text-text"
                />
                <button onClick={() => setThresholdMutation.mutate()} className="bg-primary hover:bg-secondary text-white px-3 rounded-xl font-bold text-[11px] uppercase transition-colors">Set</button>
              </div>
              <p className="text-[11px] text-muted mt-2 italic">* &gt; {threshold} người sẽ phải xếp hàng</p>
            </div>

            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Tốc độ vào (người/10s)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-3 py-1.5 text-base font-bold outline-none focus:border-primary text-text"
                />
                <button onClick={() => setBatchSizeMutation.mutate()} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 rounded-xl font-bold text-[11px] uppercase transition-colors">Set</button>
              </div>
              <p className="text-[11px] text-muted mt-2 italic">* Cho phép {batchSize} người vào mỗi đợt</p>
            </div>

            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Giả lập hàng chờ</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={simCount}
                  onChange={(e) => setSimCount(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-3 py-1.5 text-base font-bold outline-none focus:border-primary text-text"
                />
                <button onClick={() => simulateMutation.mutate()} className="bg-amber-500 hover:bg-amber-600 text-white px-3 rounded-xl font-bold text-[11px] uppercase transition-colors">Inject</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
