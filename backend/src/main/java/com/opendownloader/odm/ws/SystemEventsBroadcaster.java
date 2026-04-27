package com.opendownloader.odm.ws;

import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class SystemEventsBroadcaster {

    private static final String TOPIC = "/topic/system";

    private final SimpMessagingTemplate template;

    public SystemEventsBroadcaster(SimpMessagingTemplate template) {
        this.template = template;
    }

    public void emit(String type, Map<String, Object> payload) {
        try {
            template.convertAndSend(TOPIC, Map.of("type", type, "payload", payload == null ? Map.of() : payload));
        } catch (Exception ignored) {
        }
    }
}
