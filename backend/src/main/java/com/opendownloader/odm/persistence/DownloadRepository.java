package com.opendownloader.odm.persistence;

import java.util.List;
import java.util.Optional;

import com.opendownloader.odm.download.DownloadKind;
import com.opendownloader.odm.download.DownloadStatus;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DownloadRepository extends JpaRepository<DownloadEntity, String> {
    List<DownloadEntity> findByStatus(DownloadStatus status);
    List<DownloadEntity> findAllByOrderByCreatedAtDesc();
    Optional<DownloadEntity> findFirstByKindAndSourceIgnoreCaseOrderByCreatedAtDesc(DownloadKind kind, String source);
    long countByKindAndSourceIgnoreCaseAndIdNot(DownloadKind kind, String source, String id);
}
