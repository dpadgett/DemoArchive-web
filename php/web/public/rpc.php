<?

require __DIR__ . '/vendor/autoload.php';

$m = new MongoClient('mongodb://mongodb');

$db = $m->demos;

$collection = $db->demos;
$matches = $db->matches;

$rpc = NULL;
if (isset($_GET['rpc'])) {
  $rpc = $_GET['rpc'];
}

function format_result($result) {
  global $rpc;
  if (isset($_GET['jsonp'])) {
    return $rpc . ' = ' . json_encode($result) . ";\n";
  }
  return json_encode($result);
}

if (isset($_GET['jsonp'])) {
  header("Content-Type: text/javascript");
} else {
  header("Content-Type: application/json");
}

function search($query) {
  global $collection;
  $keys = array(
    'time_created',
    'player',
    'metadata.client.id',
    'metadata.sv_hostname',
    'metadata.maps.mapname',
    'metadata.maps.map_start_time',
    'metadata.maps.map_end_time',
    'metadata.maps.scores',
    'metadata.maps.teams',
    'metadata.maps.names',
  );
  $proj = array();
  foreach ($keys as $key) {
    $proj[$key] = 1;
  }
  $cursor = $collection->find($query, $proj);
  $offset = 0;
  if (isset($_GET['offset'])) {
    $offset = $_GET['offset'];
  }
  $limit = 10;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor->sort(array('time_created' => -1));
  $count = $cursor->count();
  $cursor->skip($offset)->limit($limit);
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc;
  }
  return array('result' => $result, 'offset' => $offset, 'limit' => $limit, 'total' => $count);
}

function strip_colors($str) {
  //return $str;
  $out = '';
  $len = strlen($str);
  for ($i = 0; $i < $len; $i++) {
    if ($str[$i] == '^' && $i + 1 < $len) {
      $code = ord($str[$i + 1]);
      if ($code >= ord('0') && $code <= ord('9')) {
        $i++;
        continue;
      }
    }
    $out .= $str[$i];
  }
  //if ($len >= 3 && substr($str, $len - 3) == "^mY") {
  //  var_dump($out);
  //}
  return $out;
}

if ($rpc == 'numdemos') {
  $result = array('numdemos' => $collection->count());
  echo format_result($result);
  exit;
} else if ($rpc == 'recentdemos') {
  $result = search(array());
  echo format_result($result);
  exit;
} else if ($rpc == 'search') {
  $query = array();
  if (isset($_GET['player'])) {
    $query['player'] = $_GET['player'];
  }
  if (isset($_GET['before'])) {
    $query['time_created'] = array('$lte' => new MongoDate(strtotime($_GET['before'] . ' America/New_York')));
  }
  if (isset($_GET['map'])) {
    $query['metadata.maps'] = array('$elemMatch' => array('mapname' => $_GET['map']));
  }
  if (isset($_GET['server'])) {
    $query['metadata.sv_hostname'] = $_GET['server'];
  }
  if (isset($_GET['match'])) {
    $query['is_match'] = $_GET['match'] === 'true';
  }
  $result = search($query);
  echo format_result($result);
  exit;
} else if ($rpc == 'topnames') {
  $limit = 20;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor = $db->names->find(array(), array());
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc['_id'];
  }
  echo format_result($result);
  exit;
} else if ($rpc == 'topmaps') {
  $limit = 20;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor = $db->maps->find(array(), array());
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc['_id'];
  }
  echo format_result($result);
  exit;
} else if ($rpc == 'topservers') {
  $limit = 20;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor = $db->servers->find(array(), array());
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc['_id'];
  }
  echo format_result($result);
  exit;
} else if ($rpc == 'recentmatches') {
  $result = search_matches(array('is_match' => True));
  echo format_result($result);
  exit;
} else if ($rpc == 'searchmatches') {
  $query = array();
  if (isset($_GET['player'])) {
    //$query['demos'] = array('$elemMatch' => array('name' => $_GET['player']));
    $query['$or'] = array(
        array('maps.0.scores.blueplayers.client_name' => $_GET['player']),
        array('maps.0.scores.redplayers.client_name' => $_GET['player']),
        array('maps.0.scores.freeplayers.client_name' => $_GET['player']),
        array('maps.0.scores.specplayers.client_name' => $_GET['player']));
  }
  if (isset($_GET['before'])) {
    $query['time_created'] = array('$lte' => new MongoDate(strtotime($_GET['before'] . ' America/New_York')));
  }
  if (isset($_GET['map'])) {
    $query['maps'] = array('$elemMatch' => array('mapname' => $_GET['map']));
  }
  if (isset($_GET['server'])) {
    $query['sv_hostname'] = $_GET['server'];
  }
  if (isset($_GET['match'])) {
    $query['is_match'] = $_GET['match'] === 'true';
  }
  $result = search_matches($query);
  echo format_result($result);
  exit;
} else if ($rpc == 'lookupmatch') {
  $result = search_matches(array('_id' => $_GET['id']));
  echo format_result($result);
  exit;
}

function search_matches($query) {
  global $matches;
  $cursor = $matches->find($query, array());
  $offset = 0;
  if (isset($_GET['offset'])) {
    $offset = $_GET['offset'];
  }
  $limit = 5;
  if (isset($_GET['limit'])) {
    $limit = $_GET['limit'];
  }
  $cursor->sort(array('time_created' => -1));
  $count = $cursor->count();
  $cursor->skip($offset)->limit($limit);
  $result = array();
  foreach ($cursor as $doc) {
    $result[] = $doc;
  }
  return array('result' => $result, 'offset' => $offset, 'limit' => $limit, 'total' => $count);
}

?>
