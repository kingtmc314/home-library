import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";

export default function ShelfLocations() {
  const shelves = trpc.shelves.list.useQuery();
  const createShelf = trpc.shelves.create.useMutation({
    onSuccess: () => {
      shelves.refetch();
      setNewShelf({ name: "", description: "" });
      toast.success("Shelf created!");
    },
  });
  const updateShelf = trpc.shelves.update.useMutation({
    onSuccess: () => {
      shelves.refetch();
      setEditingId(null);
      toast.success("Shelf updated!");
    },
  });
  const deleteShelf = trpc.shelves.delete.useMutation({
    onSuccess: () => {
      shelves.refetch();
      toast.success("Shelf deleted!");
    },
  });

  const [newShelf, setNewShelf] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });

  const handleCreate = async () => {
    if (!newShelf.name.trim()) {
      toast.error("Shelf name is required");
      return;
    }
    await createShelf.mutateAsync(newShelf);
  };

  const handleUpdate = async (id: number) => {
    if (!editForm.name.trim()) {
      toast.error("Shelf name is required");
      return;
    }
    await updateShelf.mutateAsync({ id, ...editForm });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shelf Locations</h1>
        <p className="text-muted-foreground mt-2">Manage your book shelf locations</p>
      </div>

      {/* Create New Shelf */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Shelf</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Shelf Name</Label>
            <Input
              id="name"
              placeholder="e.g., Living Room Shelf A"
              value={newShelf.name}
              onChange={(e) => setNewShelf({ ...newShelf, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="e.g., Top shelf, near the window"
              value={newShelf.description}
              onChange={(e) => setNewShelf({ ...newShelf, description: e.target.value })}
              rows={2}
            />
          </div>
          <Button onClick={handleCreate} disabled={createShelf.isPending} className="w-full">
            {createShelf.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Shelf
          </Button>
        </CardContent>
      </Card>

      {/* Shelves List */}
      {shelves.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : shelves.data && shelves.data.length > 0 ? (
        <div className="space-y-3">
          {shelves.data.map((shelf) => (
            <Card key={shelf.id}>
              <CardContent className="pt-6">
                {editingId === shelf.id ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`edit-name-${shelf.id}`}>Shelf Name</Label>
                      <Input
                        id={`edit-name-${shelf.id}`}
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-desc-${shelf.id}`}>Description</Label>
                      <Textarea
                        id={`edit-desc-${shelf.id}`}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleUpdate(shelf.id)}
                        disabled={updateShelf.isPending}
                        className="flex-1"
                      >
                        {updateShelf.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{shelf.name}</h3>
                      {shelf.description && (
                        <p className="text-sm text-muted-foreground mt-1">{shelf.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(shelf.id);
                          setEditForm({ name: shelf.name, description: shelf.description || "" });
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this shelf?")) {
                            deleteShelf.mutate({ id: shelf.id });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground">No shelves yet. Create one to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
