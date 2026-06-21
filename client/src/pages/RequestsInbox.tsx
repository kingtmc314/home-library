import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Inbox, BookOpen, FileText, Send, CheckCircle, XCircle, RefreshCw, RotateCcw } from "lucide-react";

type RequestStatus = "pending" | "approved" | "denied" | "returned";

const statusColors: Record<RequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-gray-100 text-gray-700 border-gray-200",
};

const statusLabels: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  returned: "Returned",
};

export default function RequestsInbox() {
  const { user } = useAuth();
  const isOwner = (user as any)?.isOwner === true;

  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const requests = trpc.requests.list.useQuery({ myOnly: false });
  const messages = trpc.requests.listMessages.useQuery(
    { request_id: selectedRequestId! },
    { enabled: selectedRequestId !== null, refetchInterval: 5000 }
  );

  const updateStatus = trpc.requests.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Request status updated");
      requests.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendMessage = trpc.requests.sendMessage.useMutation({
    onSuccess: () => {
      setNewMessage("");
      messages.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">This page is only accessible to the library owner.</p>
        </div>
      </div>
    );
  }

  const filteredRequests = requests.data?.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  const selectedRequest = requests.data?.find((r) => r.id === selectedRequestId);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedRequestId) return;
    sendMessage.mutate({ request_id: selectedRequestId, message: newMessage.trim() });
  };

  const handleStatusChange = (id: number, status: RequestStatus) => {
    updateStatus.mutate({ id, status });
  };

  const pendingCount = requests.data?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Requests Inbox</h1>
            {pendingCount > 0 && (
              <Badge className="bg-yellow-500 text-white text-xs px-2 py-0.5">
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Manage borrow and PDF access requests from library guests
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => requests.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request List */}
        <div className="lg:col-span-1 space-y-3">
          {requests.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
          ) : filteredRequests?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No requests found.</p>
              </CardContent>
            </Card>
          ) : (
            filteredRequests?.map((req) => {
              const book = (req as any).books;
              const isSelected = req.id === selectedRequestId;
              return (
                <Card
                  key={req.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedRequestId(req.id)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          {req.request_type === "borrow" ? (
                            <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          )}
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {req.request_type === "borrow" ? "Borrow" : "PDF Access"}
                          </span>
                        </div>
                        <p className="font-medium text-sm truncate">
                          {book?.title || `Book #${req.book_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          From: {req.requester_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(req.created_at).toLocaleDateString("en-HK", {
                            timeZone: "Asia/Hong_Kong",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${statusColors[req.status as RequestStatus]}`}
                      >
                        {statusLabels[req.status as RequestStatus]}
                      </Badge>
                    </div>

                    {/* Quick action buttons for pending */}
                    {req.status === "pending" && (
                      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-green-700 border-green-300 hover:bg-green-50 h-7 text-xs"
                          onClick={() => handleStatusChange(req.id, "approved")}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-700 border-red-300 hover:bg-red-50 h-7 text-xs"
                          onClick={() => handleStatusChange(req.id, "denied")}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Deny
                        </Button>
                      </div>
                    )}
                    {req.status === "approved" && req.request_type === "borrow" && (
                      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-gray-700 border-gray-300 hover:bg-gray-50 h-7 text-xs"
                          onClick={() => handleStatusChange(req.id, "returned")}
                          disabled={updateStatus.isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Mark Returned
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Chat Thread */}
        <div className="lg:col-span-2">
          {selectedRequest ? (
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="pb-3 border-b shrink-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">
                      {(selectedRequest as any).books?.title || `Book #${selectedRequest.book_id}`}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColors[selectedRequest.status as RequestStatus]}`}
                      >
                        {statusLabels[selectedRequest.status as RequestStatus]}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {selectedRequest.request_type === "borrow" ? "Borrow Request" : "PDF Access Request"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · From: {selectedRequest.requester_name || "Unknown"}
                      </span>
                    </div>
                    {selectedRequest.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {selectedRequest.note}
                      </p>
                    )}
                  </div>
                  {/* Status change dropdown */}
                  <div className="shrink-0 ml-3">
                    <Select
                      value={selectedRequest.status}
                      onValueChange={(v) => handleStatusChange(selectedRequest.id, v as RequestStatus)}
                    >
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="denied">Denied</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.isLoading ? (
                  <div className="text-center text-muted-foreground text-sm">Loading messages...</div>
                ) : messages.data?.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  messages.data?.map((msg) => {
                    const isOwnerMsg = msg.sender_open_id === (user as any)?.openId;
                    return (
                      <div key={msg.id} className={`flex ${isOwnerMsg ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isOwnerMsg
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {!isOwnerMsg && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {msg.sender_name || "Guest"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          <p className={`text-xs mt-1 opacity-60 ${isOwnerMsg ? "text-right" : ""}`}>
                            {new Date(msg.created_at).toLocaleTimeString("en-HK", {
                              timeZone: "Asia/Hong_Kong",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Reply to this request..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="resize-none min-h-[40px] max-h-[120px]"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Press Enter to send, Shift+Enter for new line</p>
              </div>
            </Card>
          ) : (
            <Card className="flex items-center justify-center h-[600px]">
              <div className="text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a request to view the conversation</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
