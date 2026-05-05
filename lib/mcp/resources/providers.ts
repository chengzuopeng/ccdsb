import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { detectAvailableProviders, listProviders } from '@/lib/providers';
import { getMcpIndexerReady } from '../context';

export function registerProvidersResource(server: McpServer): void {
  server.registerResource(
    'providers',
    'ccgauge://providers',
    {
      title: 'Detected providers',
      description:
        'Which AI coding CLIs ccgauge has discovered on this machine, the data directories scanned for each, and a per-source file/record count from the latest snapshot.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const status = idx.getStatus();
      const available = await detectAvailableProviders();

      const providers = listProviders().map((p) => {
        const stat = snap.bySource.find((s) => s.source === p.id);
        return {
          id: p.id,
          display_name: p.displayName.en,
          short_label: p.shortLabel,
          available: available.includes(p.id),
          parser_version: p.parserVersion,
          capabilities: p.capabilities,
          dirs: p.getDirs(),
          dirs_with_data: stat?.scannedDirs ?? [],
          files_indexed: stat?.filesScanned ?? 0,
          assistant_records: stat?.assistantRecords ?? 0,
        };
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                last_indexed_at: status.lastIndexedAt,
                index_duration_ms: status.indexDurationMs,
                loaded_from_disk: status.loadedFromDisk,
                providers,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
