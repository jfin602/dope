/** Opens the original Project Mind editor; Roadmap and legacy commands share this route. */
export async function openProjectMindOwner(
    getWidget: () => Promise<{
        isAttached: boolean;
        controller: { workspace: string | undefined; projectId: string | undefined };
        currentMind(): Promise<{ projectId: string; artifacts: { id: string }[] } | undefined>;
        navigateArtifact(id: string, workspace: string, projectId: string): Promise<boolean>;
        id: string;
    }>,
    show: (widget: { id: string; isAttached: boolean }, area: 'right') => Promise<void>,
    artifactId?: string, workspace?: string
): Promise<boolean> {
    const widget = await getWidget();
    if (artifactId !== undefined) {
        const mind = await widget.currentMind();
        if (!workspace || widget.controller.workspace !== workspace ||
            !mind?.artifacts.some(artifact => artifact.id === artifactId) ||
            !await widget.navigateArtifact(artifactId, workspace, mind.projectId) ||
            widget.controller.workspace !== workspace || widget.controller.projectId !== mind.projectId) return false;
    }
    await show(widget, 'right');
    return true;
}
