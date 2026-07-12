import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import * as api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const { data: analyses, isLoading } = useQuery({
    queryKey: ["analyses", "all"],
    queryFn: () => api.getAllAnalyses(),
  });

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAnalysis(id);
      toast.success("Analysis deleted.");
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    } catch {
      toast.error("Failed to delete analysis.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">History</h1>
        <p className="mt-1 text-muted-foreground">All your past analysis runs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Past analyses</CardTitle>
          <CardDescription>Reopen results or clean up old runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !analyses || analyses.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No analyses yet.</p>
              <Link to="/new-analysis">
                <Button className="mt-4 gap-2">
                  <FilePlus2 className="h-4 w-4" /> Run your first analysis
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {analyses.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title || "Untitled analysis"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                      {a.url ? ` · ${a.url}` : " · No URL analyzed"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {((a.results_json as { testCases?: unknown[] } | null)?.testCases?.length ?? 0)}{" "}
                      tests
                    </Badge>
                    <Link to="/results/$analysisId" params={{ analysisId: a.id }}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the analysis and its generated artifacts.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
