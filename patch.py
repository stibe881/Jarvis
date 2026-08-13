import re

path = r"c:/Webseiten und Apps/Jarvis/client/src/pages/JarvisChat.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'CheckSquare,\n} from "lucide-react";',
    'CheckSquare,\n  Folder,\n  FolderPlus,\n  FolderOpen,\n} from "lucide-react";'
)

content = content.replace(
    'const { data: suggestions } = trpc.chat.suggestions.useQuery();',
    'const { data: suggestions } = trpc.chat.suggestions.useQuery();\n  const { data: groups } = trpc.chat.listGroups.useQuery();\n  const createGroupMutation = trpc.chat.createGroup.useMutation({ onSuccess: () => utils.chat.listGroups.invalidate() });\n  const moveToGroupMutation = trpc.chat.moveToGroup.useMutation({ onSuccess: () => { utils.chat.listConversations.invalidate(); utils.chat.listGroups.invalidate(); setSelectedConvs([]); setManageMode(false); } });\n  const [expandedGroups, setExpandedGroups] = useState<number[]>([]);\n'
)

# Replace the manage actions header
content = content.replace(
    '<Trash2 size={10} /> {selectedConvs.length} Löschen\n                </button>\n              )}',
    '<Trash2 size={10} /> {selectedConvs.length} Löschen\n                </button>\n              )}\n              {manageMode && selectedConvs.length > 0 && (\n                <select\n                  className="text-[10px] bg-background text-muted-foreground border rounded px-1 ml-2"\n                  value=""\n                  onChange={(e) => {\n                    if(e.target.value) {\n                      moveToGroupMutation.mutate({ conversationIds: selectedConvs, groupId: e.target.value === "none" ? null : parseInt(e.target.value) });\n                    }\n                  }}\n                >\n                  <option value="">Verschieben...</option>\n                  <option value="none">Ohne Ordner</option>\n                  {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}\n                </select>\n              )}'
)

# Extract the existing conversation map function so we can reuse it
# Actually, let's just replace {conversations?.map(conv => (
# with the groups logic.

# The block to replace:
render_conv = """            {conversations?.map(conv => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 rounded text-xs cursor-pointer transition-all",
                  activeConvId === conv.id && !manageMode
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  manageMode &&
                    selectedConvs.includes(conv.id) &&
                    "bg-accent text-foreground"
                )}
                onClick={() => {
                  if (manageMode) {
                    setSelectedConvs(prev =>
                      prev.includes(conv.id)
                        ? prev.filter(id => id !== conv.id)
                        : [...prev, conv.id]
                    );
                  } else {
                    setActiveConvId(conv.id);
                    setShowConvSidebar(false);
                  }
                }}
              >
                {manageMode && (
                  <div
                    className={cn(
                      "w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors",
                      selectedConvs.includes(conv.id)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground"
                    )}
                  >
                    {selectedConvs.includes(conv.id) && (
                      <CheckSquare size={10} />
                    )}
                  </div>
                )}
                <span className="flex-1 truncate">{conv.title}</span>
                {!manageMode && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      deleteConvMutation.mutate({ id: conv.id });
                      if (activeConvId === conv.id) {
                        setActiveConvId(null);
                        setMessages([]);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}"""

new_render = """            {/* Groups */}
            {groups?.map(group => {
              const isExpanded = expandedGroups.includes(group.id);
              const groupConvs = conversations?.filter(c => c.groupId === group.id) || [];
              return (
                <div key={group-} className="mb-1">
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground hover:bg-accent/50"
                    onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(id => id !== group.id) : [...prev, group.id])}
                  >
                    {isExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                    <span className="flex-1 truncate">{group.name}</span>
                    <span className="text-[10px] opacity-50">{groupConvs.length}</span>
                  </div>
                  {isExpanded && groupConvs.length > 0 && (
                    <div className="pl-3 mt-1 space-y-1 border-l ml-3 border-border/50">
                      {groupConvs.map(conv => (
                        <div
                          key={conv.id}
                          className={cn(
                            "group flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-all",
                            activeConvId === conv.id && !manageMode
                              ? "bg-primary/20 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent",
                            manageMode && selectedConvs.includes(conv.id) && "bg-accent text-foreground"
                          )}
                          onClick={() => {
                            if (manageMode) {
                              setSelectedConvs(prev => prev.includes(conv.id) ? prev.filter(id => id !== conv.id) : [...prev, conv.id]);
                            } else {
                              setActiveConvId(conv.id);
                              setShowConvSidebar(false);
                            }
                          }}
                        >
                          {manageMode && (
                            <div className={cn("w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0", selectedConvs.includes(conv.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground")}>
                              {selectedConvs.includes(conv.id) && <CheckSquare size={10} />}
                            </div>
                          )}
                          <span className="flex-1 truncate">{conv.title}</span>
                          {!manageMode && (
                            <button onClick={e => { e.stopPropagation(); deleteConvMutation.mutate({ id: conv.id }); if (activeConvId === conv.id) { setActiveConvId(null); setMessages([]); } }} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped */}
            {groups && groups.length > 0 && <div className="h-px bg-border my-2" />}
            {conversations?.filter(c => !c.groupId).map(conv => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 rounded text-xs cursor-pointer transition-all",
                  activeConvId === conv.id && !manageMode
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  manageMode && selectedConvs.includes(conv.id) && "bg-accent text-foreground"
                )}
                onClick={() => {
                  if (manageMode) {
                    setSelectedConvs(prev => prev.includes(conv.id) ? prev.filter(id => id !== conv.id) : [...prev, conv.id]);
                  } else {
                    setActiveConvId(conv.id);
                    setShowConvSidebar(false);
                  }
                }}
              >
                {manageMode && (
                  <div className={cn("w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0", selectedConvs.includes(conv.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground")}>
                    {selectedConvs.includes(conv.id) && <CheckSquare size={10} />}
                  </div>
                )}
                <span className="flex-1 truncate">{conv.title}</span>
                {!manageMode && (
                  <button onClick={e => { e.stopPropagation(); deleteConvMutation.mutate({ id: conv.id }); if (activeConvId === conv.id) { setActiveConvId(null); setMessages([]); } }} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
"""

content = content.replace(render_conv, new_render)

# Add "Neue Gruppe" button if manageMode is on
content = content.replace(
    '<ScrollArea className="flex-1">',
    '<ScrollArea className="flex-1">\n          {manageMode && (\n            <div className="p-2 border-b">\n              <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1" onClick={() => {\n                const name = prompt("Name der neuen Gruppe:");\n                if (name) createGroupMutation.mutate({ name });\n              }}>\n                <FolderPlus size={12} /> Neuer Ordner\n              </Button>\n            </div>\n          )}'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
