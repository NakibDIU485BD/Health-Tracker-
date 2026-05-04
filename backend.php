<?php
/**
 * ════════════════════════════════════════════
 *  Health Tracker — backend.php
 *  Single-file PHP API with MySQL
 *  Handles: Auth, Records CRUD, Advanced CRUD
 * ════════════════════════════════════════════
 */

// ── CONFIGURATION ─────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'health_tracker');
define('DB_USER', 'root');
define('DB_PASS', '');        // XAMPP default = empty
define('DB_CHARSET', 'utf8mb4');

// ── CORS & SESSION ─────────────────────────
session_start();

// Allow local dev / Live Server origins
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ── DATABASE CONNECTION ────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $opts = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts);
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Database connection failed: ' . $e->getMessage());
            exit;
        }
    }
    return $pdo;
}

// ── HELPERS ───────────────────────────────

/** Send JSON response and exit */
function jsonResponse(bool $success, $data = null, string $error = ''): void {
    $res = ['success' => $success];
    if ($data  !== null) $res = array_merge($res, (array) $data);
    if ($error !== '')   $res['error'] = $error;
    echo json_encode($res);
    exit;
}

/** Return current authenticated user_id from session or abort */
function requireAuth(): int {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(false, null, 'Not authenticated. Please log in.');
        exit;
    }
    return (int) $_SESSION['user_id'];
}

/** Hash password */
function hashPass(string $pass): string {
    return password_hash($pass, PASSWORD_BCRYPT);
}

/** Strip user object for safe client response */
function safeUser(array $user): array {
    return ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']];
}

// ── READ REQUEST BODY ──────────────────────
$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? '';

// ════════════════════════════════════════════
//  ROUTE DISPATCHER
// ════════════════════════════════════════════
switch ($action) {

    /* ─── AUTH ─────────────────────────────── */
    case 'register':
        actionRegister($input);
        break;

    case 'login':
        actionLogin($input);
        break;

    case 'logout':
        actionLogout();
        break;

    case 'checkSession':
        actionCheckSession();
        break;

    case 'updateProfile':
        actionUpdateProfile($input);
        break;

    case 'changePassword':
        actionChangePassword($input);
        break;

    /* ─── BASIC HEALTH RECORDS ──────────────── */
    case 'getRecords':
        actionGetRecords();
        break;

    case 'createRecord':
        actionCreateRecord($input);
        break;

    case 'updateRecord':
        actionUpdateRecord($input);
        break;

    case 'deleteRecord':
        actionDeleteRecord($input);
        break;

    /* ─── ADVANCED HEALTH RECORDS ───────────── */
    case 'getAdvanced':
        actionGetAdvanced();
        break;

    case 'createAdvanced':
        actionCreateAdvanced($input);
        break;

    case 'updateAdvanced':
        actionUpdateAdvanced($input);
        break;

    case 'deleteAdvanced':
        actionDeleteAdvanced($input);
        break;

    default:
        jsonResponse(false, null, "Unknown action: $action");
}

// ════════════════════════════════════════════
//  AUTH ACTIONS
// ════════════════════════════════════════════

/**
 * Register a new user
 * Required: name, email, password
 */
function actionRegister(array $in): void {
    $name  = trim($in['name']     ?? '');
    $email = trim(strtolower($in['email'] ?? ''));
    $pass  = $in['password'] ?? '';

    // Validation
    if (!$name)                        jsonResponse(false, null, 'Name is required.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(false, null, 'Invalid email address.');
    if (strlen($pass) < 8)             jsonResponse(false, null, 'Password must be at least 8 characters.');

    $db = getDB();

    // Check duplicate email
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) jsonResponse(false, null, 'An account with this email already exists.');

    // Insert
    $stmt = $db->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
    $stmt->execute([$name, $email, hashPass($pass)]);
    $userId = (int) $db->lastInsertId();

    $_SESSION['user_id'] = $userId;
    jsonResponse(true, ['user' => ['id' => $userId, 'name' => $name, 'email' => $email]]);
}

/**
 * Login
 * Required: email, password
 */
function actionLogin(array $in): void {
    $email = trim(strtolower($in['email']    ?? ''));
    $pass  = $in['password'] ?? '';

    if (!$email || !$pass) jsonResponse(false, null, 'Email and password are required.');

    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pass, $user['password'])) {
        jsonResponse(false, null, 'Invalid email or password.');
    }

    $_SESSION['user_id'] = (int) $user['id'];
    jsonResponse(true, ['user' => safeUser($user)]);
}

/** Logout */
function actionLogout(): void {
    session_destroy();
    jsonResponse(true);
}

/** Check if session is active — called on page load */
function actionCheckSession(): void {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(false);
    }
    $db   = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) { session_destroy(); jsonResponse(false); }
    jsonResponse(true, ['user' => safeUser($user)]);
}

/** Update user name */
function actionUpdateProfile(array $in): void {
    $uid  = requireAuth();
    $name = trim($in['name'] ?? '');
    if (!$name) jsonResponse(false, null, 'Name is required.');

    $db   = getDB();
    $stmt = $db->prepare("UPDATE users SET name = ? WHERE id = ?");
    $stmt->execute([$name, $uid]);
    jsonResponse(true);
}

/** Change password */
function actionChangePassword(array $in): void {
    $uid  = requireAuth();
    $pass = $in['password'] ?? '';
    if (strlen($pass) < 8) jsonResponse(false, null, 'Password must be at least 8 characters.');

    $db   = getDB();
    $stmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
    $stmt->execute([hashPass($pass), $uid]);
    jsonResponse(true);
}

// ════════════════════════════════════════════
//  BASIC HEALTH RECORDS
// ════════════════════════════════════════════

/** Get all basic health records for current user (ordered by date ASC) */
function actionGetRecords(): void {
    $uid  = requireAuth();
    $db   = getDB();
    $stmt = $db->prepare(
        "SELECT id, user_id, date, weight, height, bmi, steps, water_intake
         FROM health_records
         WHERE user_id = ?
         ORDER BY date ASC, id ASC"
    );
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    // Cast numeric fields
    $records = array_map(fn($r) => [
        'id'           => (int)   $r['id'],
        'user_id'      => (int)   $r['user_id'],
        'date'         => $r['date'],
        'weight'       => (float) $r['weight'],
        'height'       => (float) $r['height'],
        'bmi'          => (float) $r['bmi'],
        'steps'        => (int)   $r['steps'],
        'water_intake' => (float) $r['water_intake'],
    ], $rows);
    jsonResponse(true, ['records' => $records]);
}

/** Create a new basic health record */
function actionCreateRecord(array $in): void {
    $uid    = requireAuth();
    $date   = $in['date']         ?? '';
    $weight = (float) ($in['weight']       ?? 0);
    $height = (float) ($in['height']       ?? 0);
    $bmi    = (float) ($in['bmi']          ?? 0);
    $steps  = (int)   ($in['steps']        ?? 0);
    $water  = (float) ($in['water_intake'] ?? 0);

    if (!$date || !$weight || !$height) jsonResponse(false, null, 'Date, weight, and height are required.');
    if ($weight < 20 || $weight > 300)  jsonResponse(false, null, 'Weight must be between 20–300 kg.');
    if ($height < 100 || $height > 250) jsonResponse(false, null, 'Height must be between 100–250 cm.');

    // Recalculate BMI server-side for safety
    $h     = $height / 100;
    $bmi   = round($weight / ($h * $h), 1);

    $db    = getDB();
    $stmt  = $db->prepare(
        "INSERT INTO health_records (user_id, date, weight, height, bmi, steps, water_intake)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$uid, $date, $weight, $height, $bmi, $steps, $water]);
    jsonResponse(true, ['id' => (int) $db->lastInsertId()]);
}

/** Update an existing basic health record */
function actionUpdateRecord(array $in): void {
    $uid    = requireAuth();
    $id     = (int)   ($in['id']           ?? 0);
    $date   = $in['date']         ?? '';
    $weight = (float) ($in['weight']       ?? 0);
    $height = (float) ($in['height']       ?? 0);
    $steps  = (int)   ($in['steps']        ?? 0);
    $water  = (float) ($in['water_intake'] ?? 0);

    if (!$id || !$date || !$weight || !$height) jsonResponse(false, null, 'Missing required fields.');

    // Ownership check
    $db   = getDB();
    $chk  = $db->prepare("SELECT id FROM health_records WHERE id = ? AND user_id = ?");
    $chk->execute([$id, $uid]);
    if (!$chk->fetch()) jsonResponse(false, null, 'Record not found.');

    $h   = $height / 100;
    $bmi = round($weight / ($h * $h), 1);

    $stmt = $db->prepare(
        "UPDATE health_records
         SET date=?, weight=?, height=?, bmi=?, steps=?, water_intake=?
         WHERE id=? AND user_id=?"
    );
    $stmt->execute([$date, $weight, $height, $bmi, $steps, $water, $id, $uid]);
    jsonResponse(true);
}

/** Delete a basic health record */
function actionDeleteRecord(array $in): void {
    $uid = requireAuth();
    $id  = (int) ($in['id'] ?? 0);
    if (!$id) jsonResponse(false, null, 'Invalid ID.');

    $db   = getDB();
    $stmt = $db->prepare("DELETE FROM health_records WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $uid]);
    if ($stmt->rowCount() === 0) jsonResponse(false, null, 'Record not found.');
    jsonResponse(true);
}

// ════════════════════════════════════════════
//  ADVANCED HEALTH RECORDS
// ════════════════════════════════════════════

/** Get all advanced health records for current user */
function actionGetAdvanced(): void {
    $uid  = requireAuth();
    $db   = getDB();
    $stmt = $db->prepare(
        "SELECT * FROM advanced_health
         WHERE user_id = ?
         ORDER BY date ASC, id ASC"
    );
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    $records = array_map(fn($r) => [
        'id'                => (int)    $r['id'],
        'user_id'           => (int)    $r['user_id'],
        'date'              => $r['date'],
        'systolic'          => $r['systolic']          !== null ? (int)   $r['systolic']          : null,
        'diastolic'         => $r['diastolic']         !== null ? (int)   $r['diastolic']         : null,
        'heart_rate'        => $r['heart_rate']        !== null ? (int)   $r['heart_rate']        : null,
        'blood_sugar'       => $r['blood_sugar']       !== null ? (float) $r['blood_sugar']       : null,
        'sugar_type'        => $r['sugar_type'],
        'sleep_hours'       => $r['sleep_hours']       !== null ? (float) $r['sleep_hours']       : null,
        'sleep_quality'     => $r['sleep_quality'],
        'calories'          => $r['calories']          !== null ? (int)   $r['calories']          : null,
        'protein'           => $r['protein']           !== null ? (float) $r['protein']           : null,
        'carbs'             => $r['carbs']             !== null ? (float) $r['carbs']             : null,
        'fat'               => $r['fat']               !== null ? (float) $r['fat']               : null,
        'activity_type'     => $r['activity_type'],
        'activity_duration' => $r['activity_duration'] !== null ? (int)  $r['activity_duration'] : null,
    ], $rows);
    jsonResponse(true, ['records' => $records]);
}

/** Create a new advanced health record */
function actionCreateAdvanced(array $in): void {
    $uid  = requireAuth();
    $date = $in['date'] ?? '';
    if (!$date) jsonResponse(false, null, 'Date is required.');

    $db   = getDB();
    $stmt = $db->prepare(
        "INSERT INTO advanced_health
         (user_id, date, systolic, diastolic, heart_rate, blood_sugar, sugar_type,
          sleep_hours, sleep_quality, calories, protein, carbs, fat,
          activity_type, activity_duration)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    $stmt->execute([
        $uid,
        $date,
        isset($in['systolic'])          ? (int)   $in['systolic']          : null,
        isset($in['diastolic'])         ? (int)   $in['diastolic']         : null,
        isset($in['heart_rate'])        ? (int)   $in['heart_rate']        : null,
        isset($in['blood_sugar'])       ? (float) $in['blood_sugar']       : null,
        $in['sugar_type']        ?? 'fasting',
        isset($in['sleep_hours'])       ? (float) $in['sleep_hours']       : null,
        $in['sleep_quality']     ?? 'good',
        isset($in['calories'])          ? (int)   $in['calories']          : null,
        isset($in['protein'])           ? (float) $in['protein']           : null,
        isset($in['carbs'])             ? (float) $in['carbs']             : null,
        isset($in['fat'])               ? (float) $in['fat']               : null,
        $in['activity_type']     ?? null,
        isset($in['activity_duration']) ? (int)   $in['activity_duration'] : null,
    ]);
    jsonResponse(true, ['id' => (int) $db->lastInsertId()]);
}

/** Update an existing advanced health record */
function actionUpdateAdvanced(array $in): void {
    $uid = requireAuth();
    $id  = (int) ($in['id'] ?? 0);
    $date = $in['date'] ?? '';
    if (!$id || !$date) jsonResponse(false, null, 'ID and date are required.');

    $db  = getDB();
    $chk = $db->prepare("SELECT id FROM advanced_health WHERE id = ? AND user_id = ?");
    $chk->execute([$id, $uid]);
    if (!$chk->fetch()) jsonResponse(false, null, 'Record not found.');

    $stmt = $db->prepare(
        "UPDATE advanced_health SET
         date=?, systolic=?, diastolic=?, heart_rate=?, blood_sugar=?, sugar_type=?,
         sleep_hours=?, sleep_quality=?, calories=?, protein=?, carbs=?, fat=?,
         activity_type=?, activity_duration=?
         WHERE id=? AND user_id=?"
    );
    $stmt->execute([
        $date,
        isset($in['systolic'])          ? (int)   $in['systolic']          : null,
        isset($in['diastolic'])         ? (int)   $in['diastolic']         : null,
        isset($in['heart_rate'])        ? (int)   $in['heart_rate']        : null,
        isset($in['blood_sugar'])       ? (float) $in['blood_sugar']       : null,
        $in['sugar_type']        ?? 'fasting',
        isset($in['sleep_hours'])       ? (float) $in['sleep_hours']       : null,
        $in['sleep_quality']     ?? 'good',
        isset($in['calories'])          ? (int)   $in['calories']          : null,
        isset($in['protein'])           ? (float) $in['protein']           : null,
        isset($in['carbs'])             ? (float) $in['carbs']             : null,
        isset($in['fat'])               ? (float) $in['fat']               : null,
        $in['activity_type']     ?? null,
        isset($in['activity_duration']) ? (int)   $in['activity_duration'] : null,
        $id,
        $uid,
    ]);
    jsonResponse(true);
}

/** Delete an advanced health record */
function actionDeleteAdvanced(array $in): void {
    $uid = requireAuth();
    $id  = (int) ($in['id'] ?? 0);
    if (!$id) jsonResponse(false, null, 'Invalid ID.');

    $db   = getDB();
    $stmt = $db->prepare("DELETE FROM advanced_health WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $uid]);
    if ($stmt->rowCount() === 0) jsonResponse(false, null, 'Record not found.');
    jsonResponse(true);
}
