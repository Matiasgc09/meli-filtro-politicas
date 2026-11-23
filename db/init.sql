-- Esquema inicial. Docker lo ejecuta automáticamente la primera vez que crea la base.

CREATE TABLE IF NOT EXISTS conversaciones (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  pack_id       VARCHAR(32)  NULL COMMENT 'ID de la venta/pack en Mercado Libre',
  comprador     VARCHAR(100) NULL,
  estado        ENUM('ABIERTA','EN_ESPERA','RESUELTA','RECLAMO') NOT NULL DEFAULT 'ABIERTA',
  ia_pausada    BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pack (pack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mensajes (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  conversacion_id  INT NULL,
  autor            ENUM('IA','OPERADOR','COMPRADOR') NOT NULL,
  texto            TEXT NOT NULL,
  estado           ENUM('ENVIABLE','BLOQUEADO') NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mensaje_conversacion FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id),
  INDEX idx_mensajes_estado (estado, creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada infracción detectada por el filtro queda registrada: sirve para auditar,
-- medir y ajustar las reglas con casos reales.
CREATE TABLE IF NOT EXISTS bloqueos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  mensaje_id  INT NOT NULL,
  tipo        ENUM('TELEFONO','EMAIL','LINK_EXTERNO','RED_SOCIAL','DATOS_BANCARIOS','FUERA_DE_PLATAFORMA','LONGITUD') NOT NULL,
  fragmento   VARCHAR(255) NOT NULL,
  motivo      VARCHAR(255) NOT NULL,
  CONSTRAINT fk_bloqueo_mensaje FOREIGN KEY (mensaje_id) REFERENCES mensajes(id) ON DELETE CASCADE,
  INDEX idx_bloqueos_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Frases y tono de la marca, editables desde el panel.
CREATE TABLE IF NOT EXISTS frases (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  clave   VARCHAR(60) NOT NULL UNIQUE,
  texto   TEXT NOT NULL,
  activa  BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO frases (clave, texto) VALUES
  ('saludo', '¡Hola! Gracias por tu compra.'),
  ('despedida', 'Cualquier duda, escribinos por acá. ¡Saludos!'),
  ('derivar_operador', 'Ya le pasamos tu consulta a una persona del equipo, en breve te respondemos.');
