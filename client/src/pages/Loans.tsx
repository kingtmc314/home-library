import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BookOpen,
  User,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  BookMarked,
} from "lucide-react";
import { Link } from "wouter";

function LoanCard({
  loan,
  onReturn,
  onDelete,
  isReturning,
  isDeleting,
  isOwner,
}: {
  loan: any;
  onReturn: (id: number) => void;
  onDelete: (id: number) => void;
  isReturning: boolean;
  isDeleting: boolean;
  isOwner: boolean;
}) {
  const isReturned = !!loan.returned_date;
  const isOverdue =
    !isReturned && loan.due_date && new Date(loan.due_date) < new Date();

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-md ${
        isOverdue ? "border-red-200 bg-red-50/30" : isReturned ? "opacity-70" : ""
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Book cover */}
          <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 shadow-sm">
            {loan.books?.cover_url ? (
              <img
                src={loan.books.cover_url}
                alt={loan.books?.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                <BookOpen className="w-5 h-5 text-blue-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                  {loan.books?.title || "Unknown Book"}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {loan.books?.authors || "Unknown Author"}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isReturned ? (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Returned
                  </Badge>
                ) : isOverdue ? (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Overdue
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <Clock className="w-3 h-3 mr-1" />
                    On Loan
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate font-medium text-foreground">{loan.borrower_name}</span>
              </div>
              {loan.borrower_contact && (
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span className="truncate">{loan.borrower_contact}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Lent: {formatDate(loan.lent_date)}</span>
              </div>
              {loan.due_date && (
                <div className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                  <Clock className="w-3 h-3" />
                  <span>Due: {formatDate(loan.due_date)}</span>
                </div>
              )}
              {isReturned && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Returned: {formatDate(loan.returned_date)}</span>
                </div>
              )}
            </div>

            {loan.notes && (
              <p className="text-xs text-muted-foreground italic mb-3 line-clamp-2">
                "{loan.notes}"
              </p>
            )}

            {isOwner && (
              <div className="flex items-center gap-2">
                {!isReturned && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    onClick={() => onReturn(loan.id)}
                    disabled={isReturning}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Mark Returned
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(loan.id)}
                  disabled={isDeleting}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Loans() {
  const { isAuthenticated, user } = useAuth();
  const isOwner = (user as any)?.isOwner === true;
  const utils = trpc.useUtils();

  const { data: allLoans, isLoading } = trpc.loans.list.useQuery({ activeOnly: false });
  const { data: activeLoans } = trpc.loans.list.useQuery({ activeOnly: true });
  const { data: books } = trpc.books.list.useQuery();

  const [showLendDialog, setShowLendDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [returningId, setReturningId] = useState<number | null>(null);

  const [lendForm, setLendForm] = useState({
    book_id: "",
    borrower_name: "",
    borrower_contact: "",
    due_date: "",
    notes: "",
  });

  const lendMutation = trpc.loans.lend.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate();
      setShowLendDialog(false);
      setLendForm({ book_id: "", borrower_name: "", borrower_contact: "", due_date: "", notes: "" });
      toast.success("Book lent successfully!");
    },
    onError: (e) => toast.error(e.message),
  });

  const returnMutation = trpc.loans.return.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate();
      setReturningId(null);
      toast.success("Book marked as returned!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.loans.delete.useMutation({
    onSuccess: () => {
      utils.loans.list.invalidate();
      setDeleteId(null);
      toast.success("Loan record deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const overdueLoans = allLoans?.filter(
    (l) => !l.returned_date && l.due_date && new Date(l.due_date) < new Date()
  ) || [];

  const returnedLoans = allLoans?.filter((l) => !!l.returned_date) || [];

  if (!isAuthenticated) {
    return (
      <div className="p-8 text-center">
        <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in to manage loans</h2>
        <p className="text-muted-foreground mb-4">Track which books you've lent to friends and family.</p>
        <Button asChild>
          <a href={getLoginUrl()}>Sign In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track books you've lent out and when they're due back
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowLendDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Lend a Book
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{activeLoans?.length ?? 0}</div>
            <div className="text-xs text-blue-600 mt-1">Currently Out</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-700">{overdueLoans.length}</div>
            <div className="text-xs text-red-600 mt-1">Overdue</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{returnedLoans.length}</div>
            <div className="text-xs text-green-600 mt-1">Returned</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Active
            {(activeLoans?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs h-5">{activeLoans?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            {overdueLoans.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs h-5">{overdueLoans.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Records</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : (activeLoans?.filter(l => !l.returned_date).length ?? 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No books currently on loan</p>
              <p className="text-sm mt-1">Click "Lend a Book" to record a new loan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeLoans?.filter(l => !l.returned_date).map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onReturn={(id) => { setReturningId(id); returnMutation.mutate({ id }); }}
                  onDelete={(id) => setDeleteId(id)}
                  isReturning={returningId === loan.id && returnMutation.isPending}
                  isDeleting={deleteId === loan.id && deleteMutation.isPending}
                  isOwner={isOwner}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overdue">
          {overdueLoans.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30 text-green-500" />
              <p className="font-medium">No overdue loans</p>
              <p className="text-sm mt-1">All borrowed books are within their due dates</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onReturn={(id) => { setReturningId(id); returnMutation.mutate({ id }); }}
                  onDelete={(id) => setDeleteId(id)}
                  isReturning={returningId === loan.id && returnMutation.isPending}
                  isDeleting={deleteId === loan.id && deleteMutation.isPending}
                  isOwner={isOwner}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : (allLoans?.length ?? 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No loan records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allLoans?.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onReturn={(id) => { setReturningId(id); returnMutation.mutate({ id }); }}
                  onDelete={(id) => setDeleteId(id)}
                  isReturning={returningId === loan.id && returnMutation.isPending}
                  isDeleting={deleteId === loan.id && deleteMutation.isPending}
                  isOwner={isOwner}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Lend Dialog */}
      <Dialog open={showLendDialog} onOpenChange={setShowLendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5" />
              Lend a Book
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Book *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={lendForm.book_id}
                onChange={(e) => setLendForm((f) => ({ ...f, book_id: e.target.value }))}
              >
                <option value="">Select a book...</option>
                {books?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} {b.authors ? `— ${b.authors}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Borrower Name *</Label>
              <Input
                placeholder="e.g. John Smith"
                value={lendForm.borrower_name}
                onChange={(e) => setLendForm((f) => ({ ...f, borrower_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact (optional)</Label>
              <Input
                placeholder="Phone or email"
                value={lendForm.borrower_contact}
                onChange={(e) => setLendForm((f) => ({ ...f, borrower_contact: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={lendForm.due_date}
                onChange={(e) => setLendForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this loan..."
                rows={2}
                value={lendForm.notes}
                onChange={(e) => setLendForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLendDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!lendForm.book_id || !lendForm.borrower_name.trim()) {
                  toast.error("Please select a book and enter the borrower's name.");
                  return;
                }
                lendMutation.mutate({
                  book_id: Number(lendForm.book_id),
                  borrower_name: lendForm.borrower_name,
                  borrower_contact: lendForm.borrower_contact || undefined,
                  due_date: lendForm.due_date || undefined,
                  notes: lendForm.notes || undefined,
                });
              }}
              disabled={lendMutation.isPending}
            >
              {lendMutation.isPending ? "Saving..." : "Confirm Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete loan record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this loan record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
