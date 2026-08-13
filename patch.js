const fs = require('fs');
const path = 'c:/Webseiten und Apps/Jarvis/client/src/pages/JarvisChat.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'CheckSquare,\n} from \"lucide-react\";',
  'CheckSquare,\n  Folder,\n  FolderPlus,\n  FolderOpen,\n} from \"lucide-react\";'
);

content = content.replace(
  'const { data: suggestions } = trpc.chat.suggestions.useQuery();',
  'const { data: suggestions } = trpc.chat.suggestions.useQuery();\n  const { data: groups } = trpc.chat.listGroups.useQuery();\n  const createGroupMutation = trpc.chat.createGroup.useMutation({ onSuccess: () => utils.chat.listGroups.invalidate() });\n  const moveToGroupMutation = trpc.chat.moveToGroup.useMutation({ onSuccess: () => { utils.chat.listConversations.invalidate(); utils.chat.listGroups.invalidate(); setSelectedConvs([]); setManageMode(false); } });\n  const [expandedGroups, setExpandedGroups] = useState<number[]>([]);\n'
);

content = content.replace(
  '<Trash2 size={10} /> {selectedConvs.length} Löschen\n                </button>\n              )}',
  '<Trash2 size={10} /> {selectedConvs.length} Löschen\n                </button>\n              )}\n              {manageMode && selectedConvs.length > 0 && (\n                <select\n                  className=\"text-[10px] bg-background text-muted-foreground border rounded px-1\"\n                  onChange={(e) => {\n                    if(e.target.value) {\n                      moveToGroupMutation.mutate({ conversationIds: selectedConvs, groupId: e.target.value === \"none\" ? null : parseInt(e.target.value) });\n                    }\n                  }}\n                >\n                  <option value=\"\">Verschieben...</option>\n                  <option value=\"none\">Ohne Ordner</option>\n                  {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}\n                </select>\n              )}'
);

fs.writeFileSync(path, content);
console.log('done');
