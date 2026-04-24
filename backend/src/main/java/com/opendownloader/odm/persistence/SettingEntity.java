package com.opendownloader.odm.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "settings")
public class SettingEntity {

    @Id
    @Column(name = "key_name", length = 128, nullable = false)
    private String key;

    @Column(name = "value", length = 4096)
    private String value;

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
