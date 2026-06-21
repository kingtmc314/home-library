import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, BookOpen, FileText, Send, Plus, RefreshCw } from "lucide-react";
import { useSearch } from "wouter";

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

export default function Requests() {
  const { user } = useAuth();
  const isOwner = (user as any)?.isOwner === true;

  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const preBookId = searchParams.get("book") || "";
  const preType = (searchParams.get("type") || "borrow") as "borrow" | "pdf";

  const [showNewRequest, setShowNewRequest] = useState(() => !!preBookId);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newRequestData, setNewRequestData] = useState({
    book_id: preBookId,
    request_type: preType,
    note: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const requests = trpc.requests.list.useQuery({ myOnly: true });
  const books = trpc.books.list.useQuery();
  const messages = trpc.requests.listMessages.useQuery(
    { request_id: selectedRequestId! },
    { enabled: selectedRequestId !== null, refetchInterval: 5000 }
  );

  const createRequest = trpc.requests.create.useMutation({
    onSuccess: () => {
      toast.success("Request submitted successfully!");
      setShowNewRequest(false);
      setNewRequestData({ book_id: "", request_type: "borrow", note: "" });
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

  const selectedRequest = requests.data?.find((r) => r.id === selectedRequestId);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedRequestId) return;
    sendMessage.mutate({ request_id: selectedRequestId, message: newMessage.trim() });
  };

  const handleCreateRequest = () => {
    if (!newRequestData.book_id) {
      toast.error("Please select a book");
      return;
    }
    createRequest.mutate({
      book_id: parseInt(newRequestData.book_id),
      request_type: newRequestData.request_type,
      note: newRequestData.note || undefined,
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Please log in to view your requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-muted-foreground mt-1">
            {isOwner
              ? "Your submitted borrow and PDF access requests"
              : "Request to borrow books or access PDF e-books from the library"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => requests.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => setShowNewRequest(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Request
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request List */}
        <div className="lg:col-span-1 space-y-3">
          {requests.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
          ) : requests.data?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No requests yet.</p>
                <p className="text-xs mt-1">Click "New Request" to get started.</p>
              </CardContent>
            </Card>
          ) : (
            requests.data?.map((req) => {
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
                        {book?.authors && (
                          <p className="text-xs text-muted-foreground truncate">{book.authors}</p>
                        )}
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
                  <div>
                    <CardTitle className="text-base">
                      {(selectedRequest as any).books?.title || `Book #${selectedRequest.book_id}`}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColors[selectedRequest.status as RequestStatus]}`}
                      >
                        {statusLabels[selectedRequest.status as RequestStatus]}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">
                        {selectedRequest.request_type === "borrow" ? "Borrow Request" : "PDF Access Request"}
                      </span>
                    </div>
                    {selectedRequest.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {selectedRequest.note}
                      </p>
                    )}
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
                    const isMe = msg.sender_open_id === (user as any)?.openId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {!isMe && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {msg.sender_name || "Library Owner"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          <p className={`text-xs mt-1 opacity-60 ${isMe ? "text-right" : ""}`}>
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
                    placeholder="Type a message..."
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
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a request to view the conversation</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New Request Dialog */}
      <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Book</label>
              <Select
                value={newRequestData.book_id}
                onValueChange={(v) => setNewRequestData((d) => ({ ...d, book_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a book..." />
                </SelectTrigger>
                <SelectContent>
                  {books.data?.map((book) => (
                    <SelectItem key={book.id} value={String(book.id)}>
                      {book.title}
                      {book.authors ? ` — ${book.authors}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Request Type</label>
              <Select
                value={newRequestData.request_type}
                onValueChange={(v) =>
                  setNewRequestData((d) => ({ ...d, request_type: v as "borrow" | "pdf" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrow">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      Borrow Physical Book
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      PDF / E-Book Access
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                placeholder="Any additional notes for the library owner..."
                value={newRequestData.note}
                onChange={(e) => setNewRequestData((d) => ({ ...d, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRequest(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRequest} disabled={createRequest.isPending}>
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
