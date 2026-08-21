<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Backup extends Model
{
    protected $table = 'backups';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['filename', 'path', 'size', 'type', 'status', 'provider', 'metadata', 'created_by'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
