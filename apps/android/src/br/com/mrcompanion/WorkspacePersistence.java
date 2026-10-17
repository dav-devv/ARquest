package br.com.mrcompanion;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Keeps edits authoritative while a map's coordinate reference is unavailable. */
final class WorkspacePersistence {
    static class Panel<P> {
        final String id,name;
        final float size;
        final P pose;
        Panel(String id,String name,float size,P pose){this.id=id;this.name=name;this.size=size;this.pose=pose;}
    }

    /** Inputs contain map-relative poses only; null means that no relative update is available. */
    static <P> List<Panel<P>> mergePanels(List<? extends Panel<P>> current,List<? extends Panel<P>> saved){
        Map<String,P> previous=new HashMap<>();
        for(Panel<P> panel:saved)if(panel.pose!=null)previous.put(panel.id,panel.pose);
        List<Panel<P>> result=new ArrayList<>();
        for(Panel<P> panel:current){
            P pose=panel.pose!=null?panel.pose:previous.get(panel.id);
            result.add(new Panel<>(panel.id,panel.name,panel.size,pose));
        }
        return result;
    }
}
