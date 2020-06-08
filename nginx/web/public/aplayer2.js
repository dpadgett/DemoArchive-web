
function playerrpc(name, data, callback)
{
  var alldata = data;
  alldata['rpc'] = name;
  $.ajax({
    type: 'GET',
    url: 'playerrpc.py',
    data: alldata,
    dataType: 'json',
  }).done(callback);
}

function playerpostrpc(name, data, callback)
{
  var alldata = data;
  alldata['rpc'] = name;
  $.ajax({
    type: 'POST',
    url: 'playerrpc.py',
    data: JSON.stringify(alldata),
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
  }).done(callback);
}

function Q_IsColorString(str, idx)
{
  return str[idx] == '^' && str[idx + 1] != '^' && str[idx + 1] <= '9' && str[idx + 1] >= '0';
}
function Q_CleanStr(str)
{
  dest = '';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      idx++;
    }
    else if (str.charCodeAt(idx) >= 0x20 && str.charCodeAt(idx) <= 0x7E) {
      dest += str[idx];
    }
  }
  return dest;
}
function strip_colors(str)
{
  dest = '';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      idx++;
    }
    else {
      dest += str[idx];
    }
  }
  return dest;
}

function matchColorInsensitive(values) {
  return function( request, response ) {
    var matcher = new RegExp( $.ui.autocomplete.escapeRegex( request.term ), "i" );
    response( $.grep( values, function( value ) {
      value = value.label || value.value || value;
      return matcher.test( value ) || matcher.test( strip_colors( value ) );
    }) );
  };
}

function colorToHex(color)
{
  return sprintf("%02X%02X%02X",
      parseInt(color[0] * 255 * 0.75),
      parseInt(color[1] * 255 * 0.75),
      parseInt(color[2] * 255 * 0.75));
}

var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return entityMap[s];
  });
}

function colorize(str) {
  var g_color_table = [
    [0, 0, 0, 1],			// CT_BLACK
    [1, 0, 0, 1],			// CT_RED
    [0, 1, 0, 1],			// CT_GREEN
    [1, 1, 0, 1],			// CT_YELLOW
    [0, 0, 1, 1],			// CT_BLUE
    [0, 1, 1, 1],			// CT_CYAN
    [1, 0, 1, 1],			// CT_MAGENTA
    [1, 1, 1, 1],			// CT_WHITE
  ];

  var def = g_color_table[0];
  // draw the colored text
  var out = '<span style="color:#"' + colorToHex(def) + '">';
  for (var idx = 0; idx < str.length; idx++) {
    if (Q_IsColorString(str, idx)) {
      var color = parseInt(str[idx + 1]);
      if (color > 7 || color < 0) {
        color = 0;
      }
      out += '</span><span style="color:#' + colorToHex(g_color_table[parseInt(color) % g_color_table.length]) + '">';
      idx++;
      continue;
    }
    out += str[idx];
  }
  out += '</span>';

  return out;
}

function search(offset, limit)
{
  var data = { 'offset': offset, 'limit': limit };
  var player = $('input[name="player"]').val();
  if (player != '') {
    data['name'] = player;
  }
  var hashdata = $.extend({'rpc': 'search'}, data);
  window.location.hash = $.param(hashdata);
  playerrpc('searchplayers', data, function(response) {
    $('#searchresult').text('Results');
    $('#topplayers').find('tr:gt(0)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writePlayerRow(response.result[idx], offset);
    }
    writePagination(search, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

function lookup(id)
{
  var data = { 'id': id };
  var hashdata = $.extend({'rpc': 'lookup'}, data);
  window.location.hash = $.param(hashdata);
  rpc('lookupmatch', data, function(response) {
    $('#searchresult').text('Results');
    $('#recentdemos').find('tr:gt(1)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writeDemoRow(response.result[idx], false, offset);
    }
    // removes any pagination
    $('span#page').find('a').remove();
  });
}

function writePlayerRow(player, offset)
{
  var names = [];
  var ips = [];
  var guids = [];
  var matches = [];
  var cells = [
    colorize(escapeHtml(player['name'])),
    "<a href=\"match.html#rpc=lookup&id=" + player['last_match'] + "\">" + player['last_match'] + "</a>",
    moment.duration(player['time']).humanize(),
  ];

  var row = $('<tr>');
  $.each(cells, function(idx, cell) {
    row.append($('<td>' + cell + '</td>'));
  });
  $('#topplayers tr:last').after(row);
  return offset;
}

function writePagination(rpc, count, curOffset, limit)
{
  curOffset -= curOffset % limit;
  if (typeof count === 'undefined' || isNaN(count)) {
    count = curOffset + limit;
  }
  //console.log("pagingation for " + count + ", " + curOffset + ", " + limit);
  var linkOffsets = [];
  // 4 links on each side: [0][1][2] [...] [3][*4*][5] [...] [6][7][8]
  // left side
  var numLinks = 0;
  var offset = 0;
  for (; offset < curOffset - limit && numLinks < 3; offset += limit, numLinks++) {
    linkOffsets.push(offset);
  }
  if (offset < curOffset - limit) {
    linkOffsets.push(-1);
    offset = Math.max(0, curOffset - limit);
  }
  for (; offset < count && offset <= curOffset + limit; offset += limit, numLinks++) {
    linkOffsets.push(offset);
  }
  var remainingLinks = 8 - numLinks;
  var minOffset = (count - (count % limit)) - remainingLinks * limit;
  if (offset < minOffset) {
    linkOffsets.push(-1);
    offset = Math.max(offset, minOffset);
  }
  for (; offset < count; offset += limit) {
    linkOffsets.push(offset);
  }
  $('span#page').find('a').remove();
  for (var idx = 0; idx < linkOffsets.length; idx++) {
    var offset = linkOffsets[idx];
    if (offset == -1) {
      var node = $('<a></a>').text(' ... ');
    } else {
      var node = $('<a>[' + offset + '-' + Math.min(count, offset + limit - 1) + ']</a>');
      if (offset <= curOffset && offset + limit > curOffset) {
        // not a link
      } else {
        node.attr('href', '#');
        var f = function() {
          var offset_ = offset;
          var limit_ = limit;
          node.click(function(e) {
            e.preventDefault();
            rpc(offset_, limit_);
            return false;
          });
        }();
      }
    }
    $('span#page').append(node);
  }
}

function topPlayers(offset, limit)
{
  var hashdata = {'rpc': 'topPlayers', 'offset': offset, 'limit': limit};
  window.location.hash = $.param(hashdata);
  var data = { 'offset': offset, 'limit': limit };
  playerrpc('topplayers', data, function(response) {
    $('#searchresult').text('Top players:');
    $('#topplayers').find('tr:gt(0)').remove();
    var offset = 0;
    for (var idx = 0; idx < response.result.length; idx++) {
      offset = writePlayerRow(response.result[idx], true, offset);
    }
    writePagination(topPlayers, parseInt(response.total), parseInt(response.offset), parseInt(response.limit));
  });
}

var playerApp = angular.module('playerApp', []);

var player = {'name': 'Loading...', 'matches': [], 'names': [{'name': 'Loading...'}]};

var splitIps = [];
var splitGuids = [];
var splitNames = [];

var updatePlayer;

var matchIsSplit = function(match) {
  var split = false;
  $.each(match.names, function(idx, name) {
    if ($.inArray(name.ip_hash, splitIps) != -1 || $.inArray(name.guid_hash, splitGuids) != -1) {
      if (name.guid_hash == 2706 && $.inArray(name.guid_hash, splitGuids) != -1 && match.rawtime <= 1484255083) {
        // jumy/ninja issue
        return true;
      }
      split = true;
      return false;
    }
  });
  return split;
}

playerApp.controller('PlayerCtrl', function ($scope, $http, $sce) {
  updatePlayer = function(player) {
    /*while (splitNames.length > 0) { splitNames.pop(); }
    rawnames = [];
    $.each(player.matches, function(idx, match) {
      match.split = matchIsSplit(match);
      if (match.split) {
        $.each(match.names, function(idx, name) {
          if ($.inArray(name.rawname, rawnames) == -1) {
            rawnames.push(name.rawname);
            splitNames.push(name.name);
          }
        });
      }
    });*/
    $scope.player = player;
  };
  var maxgames = 10000 //1000;
  var maxsessiongames = 100; //100;
  addGames = function(games) {
    if ($scope.player.matches.length >= maxgames) { return false; }
    var cutgames = games;
    if ($scope.player.matches.length + cutgames.length > maxgames) { cutgames = cutgames.slice(0, maxgames - $scope.player.matches.length); }
    if (cutgames.length > maxsessiongames) {
      cutgames = cutgames.slice(0, maxsessiongames);
    }
    $scope.player.matches.push(...cutgames);
    $scope.player.matches.sort((a, b) => b.rawtime - a.rawtime);
    $.each(games, function(idx, match) {
      $.each(match.games, function(idx, game) {
        var time = game.end - game.start;
        var curip = $scope.player.ipmap[game.ip] || {'ip': game.ip, 'rawtime': 0};
        curip.rawtime += time;
        curip.time = moment.duration(curip.rawtime).humanize();
        $scope.player.ipmap[game.ip] = curip;
        var curguid = $scope.player.guidmap[game.guid] || {'guid': game.guid, 'rawtime': 0};
        curguid.rawtime += time;
        curguid.time = moment.duration(curguid.rawtime).humanize();
        $scope.player.guidmap[game.guid] = curguid;
        if (game.newmod_id) {
          var curnmid = $scope.player.nmidmap[game.newmod_id] || {'newmod_id': game.newmod_id, 'rawtime': 0};
          curnmid.rawtime += time;
          curnmid.time = moment.duration(curnmid.rawtime).humanize();
          $scope.player.nmidmap[game.newmod_id] = curnmid;
        }
        $.each(game.names, function(idx, name) {
          var time = name.end - name.start;
          var curname = $scope.player.namesmap[name.rawname] || {'name': name.name, 'rawname': name.rawname, 'rawtime': 0};
          curname.rawtime += time;
          curname.time = moment.duration(curname.rawtime).humanize();
          $scope.player.namesmap[name.rawname] = curname;
        });
      });
    });
    $scope.player.names = Object.values($scope.player.namesmap);
    $scope.player.names.sort((a, b) => b.rawtime - a.rawtime);
    $scope.player.ip_hash = Object.values($scope.player.ipmap);
    $scope.player.ip_hash.sort((a, b) => b.rawtime - a.rawtime);
    $scope.player.guid_hash = Object.values($scope.player.guidmap);
    $scope.player.guid_hash.sort((a, b) => b.rawtime - a.rawtime);
    $scope.player.nmid_hash = Object.values($scope.player.nmidmap);
    $scope.player.nmid_hash.sort((a, b) => b.rawtime - a.rawtime);
    //$scope.player.name = $scope.player.names[0].name;
    return $scope.player.matches.length < maxgames;
  }
  if (window.location.hash) {
    var hashdata = $.deparam.fragment($.param.fragment(), true);
    var matchonly = window.location.pathname == '/aplayer2.html' ? '&match=true': '';
    $http.get('playerrpc.py?rpc=lookup&id=' + hashdata['id'] + matchonly).success(function(player) {
      player.matches = [];
      player.namesmap = {};
      player.names = [];
      player.ipmap = {};
      player.ip_hash = [];
      player.guidmap = {};
      player.guid_hash = [];
      player.nmidmap = {};
      player.nmid_hash = [];
      if (!('name' in player)) {
        player.name = player.last_name;
      }
      player.rawname = player.name;
      player.name = $sce.trustAsHtml(colorize(escapeHtml(player.name)));
      if ('rating' in player && 'friendly' in player.rating) {
        player.rating.friendly *= 100;
        player.rating.friendly = Math.floor(player.rating.friendly);
      }
      updatePlayer(player);
      var sessions = player['sessions'];
      sessions.sort((a, b) => b.last_game['$date'] - a.last_game['$date']);
      var fetchSession = function(session) {
        if (!session) return;
        $http.get('playerrpc.py?rpc=sessiongames&id=' + JSON.stringify(session._id) + '&limit=' + maxsessiongames + matchonly).success(function(games) {
          $.each(games, function(idx, match) {
            match.rawtime = match['time']['$date']
            match.time = moment(match['time']['$date']).format("YYYY-MM-DD hh:mm:ss a");
            if ('rating' in match) {
              match.rating.rating.start.friendly *= 100;
              match.rating.rating.start.friendly = Math.floor(match.rating.rating.start.friendly);

              match.rating.rating.updated.friendly *= 100;
              match.rating.rating.updated.friendly = Math.floor(match.rating.rating.updated.friendly);
            }
            match.split = $.inArray(JSON.stringify(match._id.session), $scope.splitSessions) != -1;
            $.each(match.games, function(idx, game) {
              $.each(game.names, function(idx, name) {
                name.rawname = name.name;
                name.name = $sce.trustAsHtml(colorize(escapeHtml(name.name)));
              });
            });
          });
          if (addGames(games)) {
            fetchSession(sessions.shift());
          }
        });
      };
      fetchSession(sessions.shift());
      // multi-call will parallelize the fetching
      fetchSession(sessions.shift());
      fetchSession(sessions.shift());
    });
  }
  player = {'name': 'Loading...', 'rawname': '', 'matches': [], 'names': [{'name': $sce.trustAsHtml('Loading...')}]};
  $scope.player = player;
  $scope.splitSessions = [];
  var markMatches = function() {
    var player = $scope.player;
    $.each(player.matches, function(idx, match) {
      match.split = $.inArray(JSON.stringify(match._id.session), $scope.splitSessions) != -1;
    });
  };
  $scope.addSession = function() {
    if (!this.match.split) {
      $scope.splitSessions.push(JSON.stringify(this.match._id.session));
    } else {
      $scope.splitSessions.splice($.inArray(JSON.stringify(this.match._id.session), $scope.splitSessions), 1);
    }
    markMatches();
  };
  $scope.splitPlayers = function() {
    var matchids = [];
    $.each($scope.player.matches, function(idx, match) {
      if (!match.split) {
        return;
      }
      matchids.push(match['_id']);
    });
    // need to add an RPC for this, manual for now
    console.log(JSON.stringify(matchids));
  };
});

function mergePlayers() {
  if (!window.location.hash) {
    return;
  }
  var hashdata = $.deparam.fragment($.param.fragment(), true);
  ids = [hashdata['id'], $('#mergeid').val()];
  console.log(ids);
  playerpostrpc('mergeplayers', {'ids': ids}, function(response) {
    console.log(response);
    location.reload();
  });
}

function setPlayerName() {
  if (!window.location.hash) {
    return;
  }
  var hashdata = $.deparam.fragment($.param.fragment(), true);
  var id = hashdata['id'];
  var name =$('#name').val();
  playerpostrpc('setname', {'id': id, 'name': name}, function(response) {
    console.log(response);
    location.reload();
  });
};

$(document).ready(function()
{
  /*if (checkmerge) {
    window.location = 'debugplayer.html' + window.location.hash;
  }*/
  // for initializing elements on the page, the rpcs should be done on page load as jsonp instead of async
  $('#numdemos').text('' + numdemos['numdemos']);
  // check if we should be loading the data via hash instead of the default data
  /*var hashRendered = false;
  if (window.location.hash) {
    var hashdata = $.deparam.fragment($.param.fragment(), true);
    var id = hashdata['id'];
    hashRendered = true;
    playerrpc('lookup', hashdata, function(response) {
      player = response;
    });
  }
  if (!hashRendered) {
    player = {'name': 'No id specified!', 'matches': [], 'names': []};
  }*/
})
