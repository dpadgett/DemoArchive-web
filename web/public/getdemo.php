<?

if (!isset($_GET['demo'])) {
  die("No demo specified");
}

$demo = $_GET['demo'];
if (substr($demo, -6) != '.dm_26' || substr($demo, 0, 18) != '/cygdrive/U/demos/' || strpos($demo, '..') !== False) {
  die('Not a demo');
}

// need to fix cygwin start
//$file = 'U:' . substr($demo, 11);
$file = substr($demo, 11);
if (!file_exists($file)) {
  header('HTTP/1.0 404 Not Found');
  die('File ' . $file . ' not found');
}

header('Content-type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($file) . '"');
readfile($file);

?>
