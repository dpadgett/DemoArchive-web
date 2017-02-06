<?php

/* PUT data comes in on the stdin stream */
$putdata = fopen("php://input", "rb");

/* Open a file for writing */
$demo = substr($_SERVER['PATH_INFO'], 1);
$demopath = "U:/demos/demobot/" . $demo;
$fp = fopen($demopath, "wb");

$indexer = "C:/Users/dan/Documents/Visual Studio 2010/Projects/JKDemoMetadata/Debug/JKDemoMetadata.exe";
$descriptorspec = array(
   0 => array("pipe", "r"),  // stdin is a pipe that the child will read from
   1 => array("pipe", "w"),  // stdout is a pipe that the child will write to
   2 => array("pipe", "w")   // stderr is a file to write to
);

$cwd = 'C:/Users/dan/Documents/Visual Studio 2010/Projects/JKDemoMetadata/Debug';
$env = array();

$cmd = '"' . escapeshellarg($indexer) . ' ' . /*escapeshellarg($demopath)*/ '-"';
//echo 'Running ' . $cmd . "\n";
$process = proc_open($cmd, $descriptorspec, $pipes, $cwd, $env);

if (!is_resource($process)) {
  die("Failed to spawn subprocess");
}

// $pipes now looks like this:
// 0 => writeable handle connected to child stdin
// 1 => readable handle connected to child stdout
// Any error output will be appended to /tmp/error-output.txt

/* Read the data 1 KB at a time
   and write to the file */
$len = 0;
while ($data = fread($putdata, 1024)) {
  set_time_limit( 90 );
  $len += strlen($data);
  fwrite($fp, $data);
  fwrite($pipes[0], $data);
  fflush($fp);
}

/* Close the streams */
fclose($fp);
fclose($putdata);

fclose($pipes[0]);

$metadata = stream_get_contents($pipes[1]);
//echo $metadata;
file_put_contents($demopath . '.dm_meta', $metadata);
fclose($pipes[1]);
//echo "stderr: " . stream_get_contents($pipes[2]);
fclose($pipes[2]);

// It is important that you close any pipes before calling
// proc_close in order to avoid a deadlock
$return_value = proc_close($process);

if ($return_value != 0) {
  exit;
}

//echo "command returned $return_value\n";

echo json_encode(array('bytes' => $len, 'file' => $demopath));

?>