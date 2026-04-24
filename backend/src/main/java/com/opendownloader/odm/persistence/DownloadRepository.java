package com.opendownloader.odm.persistence;

import java.util.List;

import com.opendownloader.odm.download.DownloadStatus;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DownloadRepository extends JpaRepository<DownloadEntity, String> {
    List<DownloadEntity> findByStatus(DownloadStatus status);
    List<DownloadEntity> findAllByOrderByCreatedAtDesc();
}
