import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, FolderInput, Folder } from "lucide-react";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface TrackerActionsDropdownProps {
  trackerId: Id<"trackers">;
  trackerName: string;
  currentFolderId: Id<"trackerFolders"> | null | undefined;
  folders: Array<{
    _id: Id<"trackerFolders">;
    name: string;
    color?: string | null;
  }> | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onMoveToFolder: (folderId: Id<"trackerFolders"> | null) => void;
  isDeleting?: boolean;
}

export default function TrackerActionsDropdown({
  trackerId: _trackerId,
  trackerName: _trackerName,
  currentFolderId,
  folders,
  onEdit,
  onDelete,
  onMoveToFolder,
  isDeleting = false,
}: TrackerActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110 hover:bg-gray-100 group"
          disabled={isDeleting}
        >
          <MoreVertical
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              "group-hover:rotate-90",
              isOpen && "rotate-90"
            )}
          />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
        {/* Quick Edits */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEdit} className="group cursor-pointer transition-all duration-150 hover:bg-gray-100">
            <Edit className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            Edit
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Organize */}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="group cursor-pointer transition-all duration-150 hover:bg-gray-100">
              <FolderInput className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="animate-in fade-in-0 zoom-in-95">
              <DropdownMenuItem onClick={() => onMoveToFolder(null)} className="group cursor-pointer transition-all duration-150 hover:bg-gray-100">
                <Folder className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                No folder (root)
              </DropdownMenuItem>
              {folders?.map((folder) => (
                <DropdownMenuItem
                  key={folder._id}
                  onClick={() => onMoveToFolder(folder._id)}
                  disabled={folder._id === currentFolderId}
                  className="group cursor-pointer transition-all duration-150 hover:bg-gray-100"
                >
                  <div
                    className="mr-2 h-4 w-4 rounded-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-md"
                    style={{ backgroundColor: folder.color || '#6B7280' }}
                  />
                  {folder.name}
                  {folder._id === currentFolderId && (
                    <span className="ml-auto text-xs text-muted-foreground">(current)</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Destructive */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive group cursor-pointer transition-all duration-150 hover:bg-red-50 hover:text-red-700"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4 transition-all duration-200 group-hover:scale-110 group-hover:text-red-700" />
          Delete
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}