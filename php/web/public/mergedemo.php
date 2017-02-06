<?

if (!isset($_GET['matchid'])) {
  die("No demo specified");
}

if (!isset($_GET['clientid'])) {
  die("No demo specified");
}

$matchid = $_GET['matchid'];
$clientid = $_GET['clientid'];

$m = new MongoClient();

$db = $m->demos;

$matches = $db->matches;

$query = array('_id' => $matchid);
$cursor = $matches->find($query, array());
$count = $cursor->count();
$result = array();
foreach ($cursor as $doc) {
  $result[] = $doc;
}
if (sizeof($result) != 1) {
  die("Found " . sizeof($result) . " matches with that id, bailing");
}

$cmd = array("C:/Users/dan/Documents/Visual Studio 2010/Projects/JKDemoMetadata/Release/DemoChanger.exe", $clientid);
foreach($result[0]['demos'] as $fulldemo) {
  $demo = $fulldemo['id'];
  if (substr($demo, -6, 5) != '.dm_2' || substr($demo, 0, 18) != '/cygdrive/U/demos/' || strpos($demo, '..') !== False) {
    die('Not a demo');
  }

  // need to fix cygwin start
  $file = 'U:' . substr($demo, 11);
  if (!file_exists($file)) {
    header('HTTP/1.0 404 Not Found');
    die('File ' . $file . ' not found');
  }
  array_push($cmd, $file);
}

array_push($cmd, "-");

$fullcmd = "";
foreach ($cmd as $arg) {
  $fullcmd .= "\"$arg\" ";
}

$fullcmd = rtrim($fullcmd);

header('Content-type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $clientid . '.' . substr($matchid, 0, 5) . '.dm_26"');

system($fullcmd);

?>
