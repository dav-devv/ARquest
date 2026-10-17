package br.com.mrcompanion;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class WorkspacePersistenceTest {
    private static int checks;
    private static void yes(boolean value){checks++;if(!value)throw new AssertionError("check "+checks);}
    private static WorkspacePersistence.Panel<String> panel(String id,String name,float size,String pose){return new WorkspacePersistence.Panel<>(id,name,size,pose);}
    public static void main(String[] args){
        List<WorkspacePersistence.Panel<String>> saved=Arrays.asList(panel("p1","Original",.65f,"relative-after-drag"),panel("p2","Removido",.8f,"relative-p2"));
        List<WorkspacePersistence.Panel<String>> result=WorkspacePersistence.mergePanels(Collections.singletonList(panel("p1","Novo nome",1.2f,null)),saved);
        yes(result.size()==1);yes(result.get(0).name.equals("Novo nome"));yes(result.get(0).size==1.2f);
        yes(result.get(0).pose.equals("relative-after-drag"));yes(saved.size()==2);yes(saved.get(0).size==.65f);
        result=WorkspacePersistence.mergePanels(Collections.singletonList(panel("p1","Novo nome",1.2f,"fresh-relative")),saved);
        yes(result.get(0).pose.equals("fresh-relative"));
        result=WorkspacePersistence.mergePanels(Collections.<WorkspacePersistence.Panel<String>>emptyList(),saved);yes(result.isEmpty());
        result=WorkspacePersistence.mergePanels(Collections.singletonList(panel("p3","Sem referência",.5f,null)),saved);
        yes(result.size()==1);yes(result.get(0).id.equals("p3"));yes(result.get(0).pose==null);
        yes(result.get(0).name.equals("Sem referência"));yes(result.get(0).size==.5f);
        // A later relative observation supplies the missing coordinates without resurrecting removed panels.
        result=WorkspacePersistence.mergePanels(Collections.singletonList(panel("p3","Sem referência",.5f,"relative-p3")),result);
        yes(result.size()==1);yes(result.get(0).pose.equals("relative-p3"));
        System.out.println("Workspace persistence: "+checks+" checks");
    }
}
